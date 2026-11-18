(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  function MockIceCandidate() {
    this.candidate = "candidate:1 1 UDP 2113667326 127.0.0.1 9 typ host";
    this.sdpMid = "0";
    this.sdpMLineIndex = 0;
  }

  function MockDataChannel() {
    this.readyState = "connecting";
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this._sent = [];
  }
  MockDataChannel.prototype.send = function (t) {
    this._sent.push(t);
  };
  MockDataChannel.prototype.close = function () {
    this.readyState = "closed";
    if (this.onclose) this.onclose();
  };

  function MockTrack(kind) {
    this.kind = kind;
    this.enabled = true;
    this.readyState = "live";
  }
  MockTrack.prototype.stop = function () {
    this.readyState = "ended";
  };

  function MockMediaStream(tracks) {
    this._tracks = (tracks || []).slice();
  }
  MockMediaStream.prototype.getTracks = function () {
    return this._tracks.slice();
  };
  MockMediaStream.prototype.getAudioTracks = function () {
    return this._tracks.filter(function (t) {
      return t.kind === "audio";
    });
  };
  MockMediaStream.prototype.getVideoTracks = function () {
    return this._tracks.filter(function (t) {
      return t.kind === "video";
    });
  };
  MockMediaStream.prototype.addTrack = function (track) {
    if (this._tracks.indexOf(track) < 0) this._tracks.push(track);
  };

  function MockSender(track) {
    this.track = track;
  }
  MockSender.prototype.replaceTrack = function (track) {
    this.track = track;
    return Promise.resolve();
  };

  var lastPc = null;

  function MockRTCPeerConnection(config) {
    lastPc = this;
    this._config = config || null;
    this.localDescription = null;
    this.remoteDescription = null;
    this.iceGatheringState = "new";
    this.signalingState = "stable";
    this.connectionState = "new";
    this.onicecandidate = null;
    this.onicegatheringstatechange = null;
    this.ondatachannel = null;
    this.ontrack = null;
    this._dc = new MockDataChannel();
    this._senders = [];
  }
  MockRTCPeerConnection.prototype.addTrack = function (track) {
    var sender = new MockSender(track);
    this._senders.push(sender);
    return sender;
  };
  MockRTCPeerConnection.prototype.getSenders = function () {
    return this._senders;
  };
  MockRTCPeerConnection.prototype.createDataChannel = function () {
    return this._dc;
  };
  MockRTCPeerConnection.prototype.createOffer = function () {
    return Promise.resolve({
      type: "offer",
      sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n",
    });
  };
  MockRTCPeerConnection.prototype.createAnswer = function () {
    return Promise.resolve({
      type: "answer",
      sdp: "v=0\r\no=- 2 1 IN IP4 127.0.0.1\r\n",
    });
  };
  MockRTCPeerConnection.prototype.setLocalDescription = function (desc) {
    this.localDescription = desc;
    if (this.onicecandidate) {
      this.onicecandidate({ candidate: new MockIceCandidate() });
    }
    this.iceGatheringState = "complete";
    if (this.onicecandidate) this.onicecandidate({ candidate: null });
    if (this.onicegatheringstatechange) this.onicegatheringstatechange();
    return Promise.resolve();
  };
  MockRTCPeerConnection.prototype.setRemoteDescription = function (desc) {
    this.remoteDescription = desc;
    this.signalingState =
      desc && desc.type === "offer" ? "have-remote-offer" : "stable";
    return Promise.resolve();
  };
  MockRTCPeerConnection.prototype.addIceCandidate = function () {
    return Promise.resolve();
  };
  MockRTCPeerConnection.prototype.close = function () {
    this.connectionState = "closed";
  };

  var VALID_OFFER = JSON.stringify({
    type: "offer",
    sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n",
    ice: [
      {
        candidate: "candidate:1 1 UDP 2113667326 127.0.0.1 9 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      },
    ],
  });
  var VALID_ANSWER = JSON.stringify({
    type: "answer",
    sdp: "v=0\r\no=- 2 1 IN IP4 127.0.0.1\r\n",
    ice: [
      {
        candidate: "candidate:2 1 UDP 2113667326 127.0.0.1 9 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      },
    ],
  });

  function installMocks() {
    lastPc = null;
    globalThis.RTCPeerConnection = MockRTCPeerConnection;
    globalThis.MediaStream = MockMediaStream;
    globalThis.navigator = globalThis.navigator || {};
    // navigator.mediaDevices is often non-writable — defineProperty so tests
    // never hit the real getUserMedia (NotFoundError: Requested device not found).
    var fakeDevices = {
      getUserMedia: function (opts) {
        var tracks = [];
        if (!opts || opts.audio !== false) tracks.push(new MockTrack("audio"));
        if (opts && opts.video) tracks.push(new MockTrack("video"));
        return Promise.resolve(new MockMediaStream(tracks));
      },
      getDisplayMedia: function () {
        return Promise.resolve(new MockMediaStream([new MockTrack("video")]));
      },
    };
    try {
      Object.defineProperty(globalThis.navigator, "mediaDevices", {
        configurable: true,
        writable: true,
        value: fakeDevices,
      });
    } catch (eDef) {
      try {
        globalThis.navigator.mediaDevices = fakeDevices;
      } catch (eAssign) {}
    }
  }

  test("peer presets parse invite reply", async function () {
    installMocks();
    var peer = await BP.require("chat/lib/peer");
    peer.reset();
    peer.setIceWaitMs(10);

    expect(peer.listIcePresets().length).toBe(4);
    expect(peer.setIcePreset("google")).toBe("google");
    expect(peer.setIcePreset("cloudflare")).toBe("cloudflare");
    expect(peer.setIcePreset("openrelay")).toBe("openrelay");
    expect(peer.setIcePreset("nope")).toBe("public");

    var invite = await peer.createInvite();
    expect(String(invite).indexOf("wu1:")).toBe(0);
    expect(peer.status().hasSession).toBe(true);
    var parsed = peer.parseBundle(invite);
    expect(parsed.type).toBe("offer");
    expect(Boolean(parsed.sdp)).toBe(true);

    expect(peer.parseBundle(VALID_OFFER).type).toBe("offer");

    var emptyErr = false;
    try {
      peer.parseBundle("");
    } catch (e) {
      emptyErr = String(e.message || e).indexOf("empty") >= 0;
    }
    expect(emptyErr).toBe(true);

    var badJson = false;
    try {
      peer.parseBundle("{");
    } catch (e2) {
      badJson = true;
    }
    expect(badJson).toBe(true);

    var noSdp = false;
    try {
      peer.parseBundle("{}");
    } catch (e3) {
      noSdp = String(e3.message || e3).indexOf("sdp") >= 0;
    }
    expect(noSdp).toBe(true);

    peer.reset();
    var reply = await peer.acceptInvite(VALID_OFFER);
    expect(String(reply).indexOf("wu1:")).toBe(0);
    expect(peer.status().polite).toBe(true);

    var notOffer = false;
    try {
      await peer.acceptInvite(VALID_ANSWER);
    } catch (e4) {
      notOffer = String(e4.message || e4).indexOf("offer") >= 0;
    }
    expect(notOffer).toBe(true);

    peer.reset();
    await peer.createInvite();
    await peer.acceptReply(VALID_ANSWER);
    expect(peer.status().hasSession).toBe(true);

    var notAnswer = false;
    try {
      await peer.acceptReply(VALID_OFFER);
    } catch (e5) {
      notAnswer = String(e5.message || e5).indexOf("answer") >= 0;
    }
    expect(notAnswer).toBe(true);

    peer.reset();
    var noSession = false;
    try {
      await peer.acceptReply(VALID_ANSWER);
    } catch (e6) {
      noSession = String(e6.message || e6).indexOf("invite") >= 0;
    }
    expect(noSession).toBe(true);
    peer.reset();
  });

  test("peer data channel send media renegotiate", async function () {
    installMocks();
    var peer = await BP.require("chat/lib/peer");
    peer.reset();
    peer.setIceWaitMs(10);

    var opened = false;
    var closed = false;
    var got = null;
    var tracked = false;
    peer.setHandlers({
      onOpen: function () {
        opened = true;
      },
      onClose: function () {
        closed = true;
      },
      onMessage: function (t) {
        got = t;
      },
      onTrack: function () {
        tracked = true;
      },
    });

    await peer.createInvite();
    opened = false;
    lastPc._dc.readyState = "open";
    if (lastPc._dc.onopen) lastPc._dc.onopen();
    expect(opened).toBe(true);
    expect(peer.isOpen()).toBe(true);
    peer.send("hello-dc");
    expect(lastPc._dc._sent.indexOf("hello-dc") >= 0).toBe(true);
    if (lastPc._dc.onmessage) lastPc._dc.onmessage({ data: "peer-hi" });
    expect(got).toBe("peer-hi");

    await peer.startMicCam({ audio: true, video: true });
    expect(Boolean(peer.getLocalStream())).toBe(true);
    peer.setMicEnabled(false);
    peer.setCamEnabled(false);
    peer.setMicEnabled(true);
    peer.setCamEnabled(true);

    var offer2 = await peer.renegotiateOffer();
    expect(String(offer2).indexOf("wu1:")).toBe(0);
    var remoteResult = await peer.acceptRemoteSdp(VALID_ANSWER);
    expect(Boolean(remoteResult)).toBe(true);

    peer.reset();
    await peer.createInvite();
    var answered = await peer.acceptRemoteSdp(VALID_OFFER);
    expect(typeof answered === "string" || Boolean(answered)).toBe(true);

    peer.reset();
    await peer.acceptInvite(VALID_OFFER);
    lastPc.signalingState = "have-local-offer";
    var politeAns = await peer.acceptRemoteSdp(VALID_OFFER);
    expect(typeof politeAns === "string" || Boolean(politeAns)).toBe(true);

    peer.reset();
    await peer.createInvite();
    var reneg = peer.renegotiateOffer();
    var collide = peer.acceptRemoteSdp(VALID_OFFER);
    var both = await Promise.all([reneg, collide]);
    expect(Boolean(both[0])).toBe(true);

    peer.reset();
    await peer.createInvite();
    await peer.startShare();
    expect(Boolean(peer.getShareStream())).toBe(true);
    await peer.stopShare();
    expect(peer.getShareStream()).toBe(null);

    if (lastPc.ontrack) lastPc.ontrack({ track: new MockTrack("audio") });
    expect(tracked).toBe(true);
    expect(Boolean(peer.getRemoteStream())).toBe(true);

    await peer.stopMedia();
    lastPc._dc.close();
    expect(closed).toBe(true);

    peer.reset();
    expect(peer.status().hasSession).toBe(false);
    expect(peer.isOpen()).toBe(false);
  });

  test("peer error paths and hung ice", async function () {
    installMocks();
    var peer = await BP.require("chat/lib/peer");
    var savedPc = globalThis.RTCPeerConnection;
    var savedMs = globalThis.MediaStream;
    var savedDevices = globalThis.navigator && globalThis.navigator.mediaDevices;

    try {
      peer.reset();
      peer.setIceWaitMs(5);

      // Hung ICE timeout path
      function HungPC(config) {
        MockRTCPeerConnection.call(this, config);
        this.iceGatheringState = "gathering";
      }
      HungPC.prototype = Object.create(MockRTCPeerConnection.prototype);
      HungPC.prototype.constructor = HungPC;
      HungPC.prototype.setLocalDescription = function (desc) {
        this.localDescription = desc;
        return Promise.resolve();
      };
      globalThis.RTCPeerConnection = HungPC;
      var hung = await peer.createInvite();
      expect(String(hung).indexOf("wu1:")).toBe(0);

      installMocks();
      peer.reset();
      await peer.createInvite();

      // navigator.mediaDevices is often read-only — redefine when possible
      try {
        Object.defineProperty(globalThis.navigator, "mediaDevices", {
          configurable: true,
          writable: true,
          value: undefined,
        });
      } catch (eDef) {
        globalThis.navigator.mediaDevices = undefined;
      }
      var noGum = false;
      try {
        await peer.startMicCam({ video: true });
      } catch (e8) {
        noGum = String(e8.message || e8).indexOf("getUserMedia") >= 0;
      }
      if (!noGum) {
        // Fallback: rejecting stubs still exercise failure paths
        Object.defineProperty(globalThis.navigator, "mediaDevices", {
          configurable: true,
          writable: true,
          value: {
            getUserMedia: function () {
              return Promise.reject(new Error("getUserMedia is not available"));
            },
            getDisplayMedia: function () {
              return Promise.reject(
                new Error("getDisplayMedia is not available"),
              );
            },
          },
        });
        try {
          await peer.startMicCam({ video: true });
        } catch (e8b) {
          noGum = String(e8b.message || e8b).indexOf("getUserMedia") >= 0;
        }
      }
      expect(noGum).toBe(true);

      var noShare = false;
      try {
        await peer.startShare();
      } catch (e9) {
        noShare = String(e9.message || e9).indexOf("getDisplayMedia") >= 0;
      }
      expect(noShare).toBe(true);

      installMocks();
      peer.reset();
      await peer.createInvite();
      var noOpen = false;
      try {
        peer.send("x");
      } catch (e10) {
        noOpen = String(e10.message || e10).indexOf("data channel") >= 0;
      }
      expect(noOpen).toBe(true);

      peer.reset();
      var noReneg = false;
      try {
        await peer.renegotiateOffer();
      } catch (e11) {
        noReneg = true;
      }
      expect(noReneg).toBe(true);

      var noMic = false;
      try {
        await peer.startMicCam({});
      } catch (e12) {
        noMic = true;
      }
      expect(noMic).toBe(true);

      var noRemote = false;
      try {
        await peer.acceptRemoteSdp(VALID_OFFER);
      } catch (e13) {
        noRemote = true;
      }
      expect(noRemote).toBe(true);

      // Missing RTCPeerConnection
      globalThis.RTCPeerConnection = function Broken() {};
      // typeof function still — use non-function
      globalThis.RTCPeerConnection = 1;
      var missing = false;
      try {
        await peer.createInvite();
      } catch (e) {
        missing = String(e.message || e).indexOf("RTCPeerConnection") >= 0;
      }
      expect(missing).toBe(true);

      expect(
        String(peer.encodeBundle({ type: "offer", sdp: "x" })).indexOf("wu1:"),
      ).toBe(0);

      // encodeBundle catch → raw json fallback
      var realBtoa = globalThis.btoa;
      globalThis.btoa = function () {
        throw new Error("btoa fail");
      };
      expect(
        String(peer.encodeBundle({ type: "offer", sdp: "z" })).indexOf("offer") >=
          0,
      ).toBe(true);
      globalThis.btoa = realBtoa;

      // MediaStream constructor throws → fake stream fallback
      installMocks();
      peer.reset();
      await peer.createInvite();
      var BoomMS = function () {
        throw new Error("no ms");
      };
      globalThis.MediaStream = BoomMS;
      if (lastPc && lastPc.ontrack) {
        lastPc.ontrack({ track: new MockTrack("video") });
      }
      var remote = peer.getRemoteStream();
      expect(Boolean(remote)).toBe(true);
      expect(Array.isArray(remote.getTracks())).toBe(true);
      remote.addTrack(new MockTrack("audio"));
      expect(remote.getTracks().length).toBeGreaterThan(0);

      // setHandlers while dc already open
      lastPc._dc.readyState = "open";
      var opened2 = false;
      peer.setHandlers({
        onOpen: function () {
          opened2 = true;
        },
      });
      expect(opened2).toBe(true);

      // replaceTrack path: add sender then startMicCam again
      installMocks();
      peer.reset();
      await peer.createInvite();
      await peer.startMicCam({ audio: true, video: false });
      await peer.startMicCam({ audio: true, video: false });

      // ice complete via state-change callback (not already complete)
      function SlowPC(config) {
        MockRTCPeerConnection.call(this, config);
        this.iceGatheringState = "gathering";
      }
      SlowPC.prototype = Object.create(MockRTCPeerConnection.prototype);
      SlowPC.prototype.constructor = SlowPC;
      SlowPC.prototype.setLocalDescription = function (desc) {
        var self = this;
        this.localDescription = desc;
        if (this.onicecandidate) {
          this.onicecandidate({ candidate: new MockIceCandidate() });
        }
        setTimeout(function () {
          self.iceGatheringState = "complete";
          if (self.onicegatheringstatechange) self.onicegatheringstatechange();
        }, 5);
        return Promise.resolve();
      };
      globalThis.RTCPeerConnection = SlowPC;
      peer.setIceWaitMs(200);
      peer.reset();
      var slowInvite = await peer.createInvite();
      expect(String(slowInvite).indexOf("wu1:")).toBe(0);
    } finally {
      globalThis.RTCPeerConnection = savedPc || MockRTCPeerConnection;
      globalThis.MediaStream = savedMs || MockMediaStream;
      if (globalThis.navigator) {
        globalThis.navigator.mediaDevices = savedDevices;
      }
      installMocks();
      peer.reset();
    }
  });
})();
