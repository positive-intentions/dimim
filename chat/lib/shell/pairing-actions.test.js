(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  function makeDeps(overrides) {
    var state = {
      profile: {
        displayName: "Ada",
        handle: "ada",
        icePreset: "public",
        completed: false,
      },
      connection: {
        phase: "profile",
        peer: null,
        localCode: "",
        statusBanner: "",
        role: "",
      },
      minting: false,
      incomingOpen: false,
      sent: [],
      ended: 0,
    };
    var helloSentRef = { current: false };
    var peer = {
      _hasSession: false,
      setIcePreset: function () {},
      createInvite: function () {
        peer._hasSession = true;
        return Promise.resolve("wu1:offer");
      },
      parseBundle: function (code) {
        if (String(code).indexOf("offer") >= 0) return { type: "offer" };
        if (String(code).indexOf("answer") >= 0) return { type: "answer" };
        if (String(code).indexOf("bad") >= 0) throw new Error("bad bundle");
        return { type: "unknown" };
      },
      acceptInvite: function () {
        peer._hasSession = true;
        return Promise.resolve("wu1:answer");
      },
      acceptReply: function () {
        return Promise.resolve();
      },
      reset: function () {
        peer._hasSession = false;
      },
      status: function () {
        return { hasSession: peer._hasSession };
      },
    };
    var deps = {
      peer: peer,
      safeSend: function (p) {
        state.sent.push(p);
      },
      getProfile: function () {
        return state.profile;
      },
      getConnection: function () {
        return state.connection;
      },
      setProfile: function (p) {
        state.profile = p;
      },
      setConnection: function (c) {
        state.connection = c;
      },
      setMinting: function (v) {
        state.minting = v;
      },
      setIncomingOpen: function (v) {
        state.incomingOpen = v;
      },
      helloSentRef: helloSentRef,
      endCall: function () {
        state.ended += 1;
      },
    };
    if (overrides) {
      Object.keys(overrides).forEach(function (k) {
        deps[k] = overrides[k];
      });
    }
    return { state: state, deps: deps, peer: peer, helloSentRef: helloSentRef };
  }

  test("pairing-actions mint profile paste hello disconnect", async function () {
    var mod = await BP.require("chat/lib/shell/pairing-actions");
    var frames = await BP.require("chat/lib/frames");
    var qrPayload = await BP.require("chat/lib/qr-payload");
    var ctx = makeDeps();
    var api = mod.createPairingActions(ctx.deps);

    var bad = api.handleProfileContinue({ displayName: "", handle: "" });
    expect(bad.ok).toBe(false);

    var ok = api.handleProfileContinue({
      displayName: "Ada",
      handle: "ada",
    });
    expect(ok.ok).toBe(true);
    await sleep(20);
    expect(ctx.state.minting).toBe(false);
    expect(ctx.state.connection.localCode).toBe("wu1:offer");
    expect(ctx.state.connection.role).toBe("offerer");

    ctx.peer.createInvite = function () {
      return Promise.reject(new Error("ice fail"));
    };
    api.mintInvite(ctx.state.profile);
    await sleep(20);
    expect(String(ctx.state.connection.statusBanner).indexOf("Failed")).toBe(0);

    expect(api.handlePasteCode("").ok).toBe(false);
    expect(api.handlePasteCode("bad").ok).toBe(false);

    var offerResult = api.handlePasteCode("wu1:offer-code");
    expect(offerResult.ok).toBe(true);
    await sleep(20);
    expect(ctx.state.connection.role).toBe("answerer");

    ctx.peer.acceptInvite = function () {
      return Promise.reject(new Error("accept no"));
    };
    api.handlePasteCode("wu1:offer-again");
    await sleep(20);
    expect(String(ctx.state.connection.statusBanner).indexOf("Accept")).toBe(0);

    ctx.state.connection = {
      phase: "shareInvite",
      peer: null,
      localCode: "x",
      statusBanner: "",
      role: "offerer",
    };
    var answerResult = api.handlePasteCode("wu1:answer-code");
    expect(answerResult.ok).toBe(true);
    await sleep(20);

    ctx.peer.acceptReply = function () {
      return Promise.reject(new Error("reply no"));
    };
    api.handlePasteCode("wu1:answer-again");
    await sleep(20);
    expect(String(ctx.state.connection.statusBanner).indexOf("Reply")).toBe(0);

    expect(api.handlePasteCode("wu1:other").ok).toBe(false);

    var origFromQr = qrPayload.fromQr;
    qrPayload.fromQr = function () {
      return Promise.resolve("wu1:offer-from-qr");
    };
    ctx.peer.acceptInvite = function () {
      return Promise.resolve("wu1:answer");
    };
    var z = api.handlePasteCode(qrPayload.PREFIX_Z + "payload");
    expect(z.ok).toBe(true);
    await sleep(20);
    qrPayload.fromQr = function () {
      return Promise.resolve("bad");
    };
    api.handlePasteCode(qrPayload.PREFIX_Z + "bad");
    await sleep(20);
    qrPayload.fromQr = function () {
      return Promise.reject(new Error("expand"));
    };
    api.handlePasteCode(qrPayload.PREFIX_Z + "fail");
    await sleep(20);
    expect(String(ctx.state.connection.statusBanner).indexOf("QR expand")).toBe(
      0,
    );
    qrPayload.fromQr = origFromQr;

    ctx.helloSentRef.current = false;
    ctx.state.connection.phase = "connecting";
    api.sendHello();
    expect(ctx.helloSentRef.current).toBe(true);
    expect(ctx.state.sent.length).toBe(1);
    expect(frames.decode(ctx.state.sent[0]).type).toBe("hello");
    api.sendHello();
    expect(ctx.state.sent.length).toBe(1);

    ctx.state.connection.phase = "connected";
    ctx.helloSentRef.current = false;
    api.sendHello();
    expect(ctx.helloSentRef.current).toBe(true);

    ctx.peer.createInvite = function () {
      ctx.peer._hasSession = true;
      return Promise.resolve("wu1:remint");
    };
    api.handleDisconnect();
    await sleep(20);
    expect(ctx.state.ended).toBe(1);
    expect(ctx.state.incomingOpen).toBe(false);
    expect(ctx.helloSentRef.current).toBe(false);
    expect(ctx.state.connection.phase).toBe("shareInvite");
    expect(ctx.state.connection.localCode).toBe("wu1:remint");
  });

  test("pairing-actions ensureFreshInvite guards and remint", async function () {
    var mod = await BP.require("chat/lib/shell/pairing-actions");
    var ctx = makeDeps();
    var api = mod.createPairingActions(ctx.deps);
    var mintCount = 0;
    ctx.peer.createInvite = function () {
      mintCount += 1;
      ctx.peer._hasSession = true;
      return Promise.resolve("wu1:fresh-" + mintCount);
    };

    expect(api.ensureFreshInvite()).toBe(false);

    ctx.state.profile.completed = true;
    ctx.state.connection.phase = "shareInvite";
    ctx.state.connection.localCode = "wu1:stale";
    ctx.peer._hasSession = false;
    expect(api.ensureFreshInvite()).toBe(true);
    await sleep(20);
    expect(mintCount).toBe(1);
    expect(ctx.state.connection.localCode).toBe("wu1:fresh-1");

    expect(api.ensureFreshInvite()).toBe(false);
    expect(mintCount).toBe(1);

    ctx.peer._hasSession = false;
    ctx.state.minting = false;
    ctx.peer.createInvite = function () {
      mintCount += 1;
      return new Promise(function () {});
    };
    expect(api.ensureFreshInvite()).toBe(true);
    expect(mintCount).toBe(2);
    expect(api.ensureFreshInvite()).toBe(false);

    var ctx2 = makeDeps();
    var api2 = mod.createPairingActions(ctx2.deps);
    var disconnectMints = 0;
    ctx2.state.profile.completed = true;
    ctx2.state.connection = {
      phase: "connected",
      peer: { id: "bo", displayName: "Bo", handle: "bo" },
      localCode: "wu1:old",
      statusBanner: "",
      role: "offerer",
    };
    ctx2.peer._hasSession = false;
    ctx2.peer.createInvite = function () {
      disconnectMints += 1;
      ctx2.peer._hasSession = true;
      return Promise.resolve("wu1:after-disconnect");
    };
    expect(api2.ensureFreshInvite()).toBe(true);
    await sleep(20);
    expect(ctx2.state.ended).toBe(1);
    expect(ctx2.state.connection.phase).toBe("shareInvite");
    expect(ctx2.state.connection.peer).toBe(null);
    expect(ctx2.state.connection.localCode).toBe("wu1:after-disconnect");
    expect(disconnectMints).toBe(1);

    var ctx3 = makeDeps();
    var unpairingRef = { current: false };
    ctx3.deps.unpairingRef = unpairingRef;
    var api3 = mod.createPairingActions(ctx3.deps);
    ctx3.state.connection.phase = "connected";
    ctx3.peer.createInvite = function () {
      return Promise.resolve("wu1:x");
    };
    unpairingRef.current = true;
    api3.handleDisconnect();
    expect(ctx3.state.ended).toBe(0);
  });
})();
