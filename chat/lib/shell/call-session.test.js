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
      callOpen: false,
      callKind: "voice",
      callPhase: "ringing",
      callMinimized: false,
      incomingOpen: false,
      incomingKind: "voice",
      sharing: false,
      media: 0,
      sent: [],
    };
    var peer = {
      startMicCam: function () {
        return Promise.resolve();
      },
      renegotiateOffer: function () {
        return Promise.resolve("offer-sdp");
      },
      stopMedia: function () {
        return Promise.resolve();
      },
      acceptRemoteSdp: function () {
        return Promise.resolve("answer-sdp");
      },
      startShare: function () {
        return Promise.resolve();
      },
      stopShare: function () {
        return Promise.resolve();
      },
    };
    var deps = {
      peer: peer,
      safeSend: function (p) {
        state.sent.push(p);
      },
      bumpMedia: function () {
        state.media += 1;
      },
      getIncomingKind: function () {
        return state.incomingKind;
      },
      getSharing: function () {
        return state.sharing;
      },
      setCallOpen: function (v) {
        state.callOpen = v;
      },
      setCallKind: function (v) {
        state.callKind = v;
      },
      setCallPhase: function (v) {
        state.callPhase = v;
      },
      setCallMinimized: function (v) {
        state.callMinimized = v;
      },
      setIncomingOpen: function (v) {
        state.incomingOpen = v;
      },
      setIncomingKind: function (v) {
        state.incomingKind = v;
      },
      setSharing: function (v) {
        state.sharing = v;
      },
    };
    if (overrides) {
      Object.keys(overrides).forEach(function (k) {
        deps[k] = overrides[k];
      });
    }
    return { state: state, deps: deps, peer: peer };
  }

  test("call-session outbound accept decline end and frames", async function () {
    var mod = await BP.require("chat/lib/shell/call-session");
    var frames = await BP.require("chat/lib/frames");
    var ctx = makeDeps();
    var api = mod.createCallSession(ctx.deps);

    api.startOutboundCall("video");
    await sleep(20);
    expect(ctx.state.callKind).toBe("video");
    expect(ctx.state.callOpen).toBe(true);
    expect(ctx.state.callPhase).toBe("active");
    expect(ctx.state.sent.length).toBeGreaterThan(0);

    ctx.state.incomingKind = "voice";
    ctx.state.incomingOpen = true;
    api.acceptIncoming();
    await sleep(20);
    expect(ctx.state.callPhase).toBe("active");
    expect(ctx.state.incomingOpen).toBe(false);

    api.declineIncoming();
    expect(ctx.state.incomingOpen).toBe(false);

    api.endCall();
    await sleep(10);
    expect(ctx.state.callOpen).toBe(false);
    expect(ctx.state.callPhase).toBe("ended");
    expect(ctx.state.sharing).toBe(false);

    api.failCall(new Error("boom"));
    expect(ctx.state.callPhase).toBe("error: boom");
    api.failCall("plain");
    expect(ctx.state.callPhase).toBe("error: plain");

    api.handleCallFrame({ action: "invite", kind: "video" });
    expect(ctx.state.incomingKind).toBe("video");
    expect(ctx.state.incomingOpen).toBe(true);

    api.handleCallFrame({ action: "accept" });
    expect(ctx.state.callOpen).toBe(true);
    expect(ctx.state.callPhase).toBe("active");

    api.handleCallFrame({ action: "hangup" });
    await sleep(10);
    expect(ctx.state.callOpen).toBe(false);
    expect(ctx.state.callPhase).toBe("ended");

    api.handleCallFrame({ action: "reject" });
    await sleep(10);

    ctx.state.sent = [];
    api.handleCallSdpFrame({ bundle: "remote" });
    await sleep(10);
    expect(ctx.state.media).toBeGreaterThan(0);
    expect(ctx.state.sent.length).toBe(1);

    api.handleCallSdpFrame({});
    ctx.peer.acceptRemoteSdp = function () {
      return Promise.reject(new Error("sdp fail"));
    };
    api.handleCallSdpFrame({ bundle: "x" });
    await sleep(10);

    ctx.peer.acceptRemoteSdp = function () {
      return Promise.resolve(null);
    };
    api.handleCallSdpFrame({ bundle: "y" });
    await sleep(10);
  });

  test("call-session toggle share both directions", async function () {
    var mod = await BP.require("chat/lib/shell/call-session");
    var ctx = makeDeps();
    var api = mod.createCallSession(ctx.deps);

    api.toggleShare();
    await sleep(20);
    expect(ctx.state.sharing).toBe(true);

    api.toggleShare();
    await sleep(20);
    expect(ctx.state.sharing).toBe(false);

    ctx.peer.startShare = function () {
      return Promise.reject(new Error("share fail"));
    };
    api.toggleShare();
    await sleep(20);
    expect(String(ctx.state.callPhase).indexOf("error:")).toBe(0);

    ctx.state.sharing = true;
    ctx.peer.stopShare = function () {
      return Promise.reject(new Error("stop fail"));
    };
    api.toggleShare();
    await sleep(20);

    ctx.state.sharing = false;
    ctx.peer.startShare = function () {
      return Promise.resolve();
    };
    ctx.peer.renegotiateOffer = function () {
      return Promise.resolve("");
    };
    api.toggleShare();
    await sleep(20);
    expect(ctx.state.sharing).toBe(true);
  });

  test("call-session startMicCam failure", async function () {
    var mod = await BP.require("chat/lib/shell/call-session");
    var ctx = makeDeps();
    ctx.peer.startMicCam = function () {
      return Promise.reject(new Error("denied"));
    };
    var api = mod.createCallSession(ctx.deps);
    api.startOutboundCall("voice");
    await sleep(20);
    expect(ctx.state.callPhase).toBe("error: denied");

    api.acceptIncoming();
    await sleep(20);
    expect(ctx.state.callPhase).toBe("error: denied");
  });
})();
