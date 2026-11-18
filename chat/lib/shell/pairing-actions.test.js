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
      setIcePreset: function () {},
      createInvite: function () {
        return Promise.resolve("wu1:offer");
      },
      parseBundle: function (code) {
        if (String(code).indexOf("offer") >= 0) return { type: "offer" };
        if (String(code).indexOf("answer") >= 0) return { type: "answer" };
        if (String(code).indexOf("bad") >= 0) throw new Error("bad bundle");
        return { type: "unknown" };
      },
      acceptInvite: function () {
        return Promise.resolve("wu1:answer");
      },
      acceptReply: function () {
        return Promise.resolve();
      },
      reset: function () {},
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
      return Promise.resolve("wu1:remint");
    };
    api.handleDisconnect();
    await sleep(20);
    expect(ctx.state.ended).toBe(1);
    expect(ctx.state.incomingOpen).toBe(false);
    expect(ctx.helloSentRef.current).toBe(false);
  });
})();
