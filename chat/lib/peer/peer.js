/**
 * Bundled offer/answer WebRTC helper (no trickle ICE).
 * Shape matches webrtc Meet: invite → reply, data channel + in-band media renegotiation.
 */
BP.module("chat/lib/peer", [], function () {
  var ICE_WAIT_STUN_MS = 2500;
  var ICE_WAIT_MULTI_STUN_MS = 4000;
  var ICE_WAIT_TURN_MS = 8000;

  var GOOGLE_STUN = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun2.l.google.com:19302",
  ];

  var PUBLIC_STUN = GOOGLE_STUN.concat([
    "stun:stun.cloudflare.com:3478",
    "stun:stun.stunprotocol.org:3478",
  ]);

  var OPENRELAY_TURN = {
    username: "openrelayproject",
    credential: "openrelayproject",
  };

  function stunServers(urls) {
    return urls.map(function (url) {
      return { urls: url };
    });
  }

  var ICE_PRESETS = {
    public: {
      id: "public",
      label: "Public STUN (redundant)",
      iceWaitMs: ICE_WAIT_MULTI_STUN_MS,
      iceServers: stunServers(PUBLIC_STUN),
    },
    google: {
      id: "google",
      label: "Google STUN",
      iceWaitMs: ICE_WAIT_MULTI_STUN_MS,
      iceServers: stunServers(GOOGLE_STUN),
    },
    cloudflare: {
      id: "cloudflare",
      label: "Cloudflare STUN",
      iceWaitMs: ICE_WAIT_STUN_MS,
      iceServers: stunServers(["stun:stun.cloudflare.com:3478"]),
    },
    openrelay: {
      id: "openrelay",
      label: "OpenRelay STUN+TURN",
      iceWaitMs: ICE_WAIT_TURN_MS,
      iceServers: stunServers(PUBLIC_STUN).concat([
        { urls: "stun:stun.relay.metered.ca:80" },
        { urls: "turn:standard.relay.metered.ca:80", username: OPENRELAY_TURN.username, credential: OPENRELAY_TURN.credential },
        {
          urls: "turns:standard.relay.metered.ca:443?transport=tcp",
          username: OPENRELAY_TURN.username,
          credential: OPENRELAY_TURN.credential,
        },
      ]),
    },
  };

  var icePresetId = "public";
  var iceConfig = { iceServers: ICE_PRESETS.public.iceServers.slice() };
  var iceWaitMs = ICE_PRESETS.public.iceWaitMs;

  var session = null;
  var handlers = {
    onMessage: null,
    onOpen: null,
    onClose: null,
    onTrack: null,
  };

  function cloneServers(servers) {
    return (servers || []).map(function (s) {
      return {
        urls: Array.isArray(s.urls) ? s.urls.slice() : s.urls,
        username: s.username,
        credential: s.credential,
      };
    });
  }

  function requireRtc() {
    if (typeof globalThis.RTCPeerConnection !== "function") {
      throw new Error("RTCPeerConnection is not available in this browser");
    }
  }

  function makeSession() {
    return {
      pc: null,
      dc: null,
      ice: [],
      pending: [],
      localStream: null,
      shareStream: null,
      remoteStream: null,
      makingOffer: false,
      ignoreOffer: false,
      polite: false,
    };
  }

  function getSession() {
    if (!session) session = makeSession();
    return session;
  }

  function stopStream(stream) {
    if (!stream) return;
    var tracks = stream.getTracks ? stream.getTracks() : [];
    for (var i = 0; i < tracks.length; i++) {
      try {
        tracks[i].stop();
      } catch (e) {}
    }
  }

  function ensureRemoteStream(s) {
    if (!s.remoteStream) {
      if (typeof MediaStream === "function") {
        try {
          s.remoteStream = new MediaStream();
        } catch (e) {
          s.remoteStream = null;
        }
      }
      if (!s.remoteStream) {
        s.remoteStream = {
          _tracks: [],
          getTracks: function () {
            return this._tracks;
          },
          addTrack: function (t) {
            this._tracks.push(t);
          },
        };
      }
    }
    return s.remoteStream;
  }

  function setIcePreset(id) {
    var preset = ICE_PRESETS[id] || ICE_PRESETS.public;
    icePresetId = preset.id;
    iceConfig = { iceServers: cloneServers(preset.iceServers) };
    iceWaitMs = preset.iceWaitMs;
    return icePresetId;
  }

  function setIceWaitMs(ms) {
    iceWaitMs = Math.max(0, Number(ms) || 0);
  }

  function listIcePresets() {
    return Object.keys(ICE_PRESETS).map(function (id) {
      return { id: ICE_PRESETS[id].id, label: ICE_PRESETS[id].label };
    });
  }

  function encodeBundle(obj) {
    var json = typeof obj === "string" ? obj : JSON.stringify(obj);
    try {
      return (
        "wu1:" +
        btoa(unescape(encodeURIComponent(json)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(new RegExp("=+$"), "")
      );
    } catch (e) {
      return json;
    }
  }

  function decodePayload(raw) {
    var text = String(raw || "").trim();
    if (!text) throw new Error("empty signaling paste");
    if (text.indexOf("wu1:") === 0) {
      var b64 = text.slice(4).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      text = decodeURIComponent(escape(atob(b64)));
    }
    var bundle;
    try {
      bundle = JSON.parse(text);
    } catch (e) {
      throw new Error("invalid signaling JSON");
    }
    if (!bundle || typeof bundle !== "object" || !bundle.sdp) {
      throw new Error("signaling bundle missing sdp");
    }
    return bundle;
  }

  function parseBundle(raw) {
    return decodePayload(raw);
  }

  function attachIceListener(s, connection) {
    s.ice = [];
    connection.onicecandidate = function (ev) {
      if (ev.candidate) {
        s.ice.push({
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid,
          sdpMLineIndex: ev.candidate.sdpMLineIndex,
        });
      }
    };
  }

  function waitIceComplete(s) {
    if (!s.pc) return Promise.reject(new Error("no local session"));
    if (s.pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise(function (resolve) {
      var t = setTimeout(resolve, iceWaitMs);
      var check = function () {
        if (s.pc && s.pc.iceGatheringState === "complete") {
          clearTimeout(t);
          s.pc.onicegatheringstatechange = null;
          resolve();
        }
      };
      s.pc.onicegatheringstatechange = check;
      check();
    });
  }

  function localBundle(s, type) {
    return {
      type: type,
      sdp: s.pc.localDescription.sdp,
      ice: s.ice.slice(),
    };
  }

  function applyRemote(s, bundleJson) {
    var bundle =
      typeof bundleJson === "string" ? parseBundle(bundleJson) : bundleJson;
    return s.pc
      .setRemoteDescription({ type: bundle.type, sdp: bundle.sdp })
      .then(function () {
        var chain = Promise.resolve();
        (bundle.ice || []).forEach(function (c) {
          chain = chain.then(function () {
            return s.pc.addIceCandidate({
              candidate: c.candidate,
              sdpMid: c.sdpMid != null ? c.sdpMid : null,
              sdpMLineIndex: c.sdpMLineIndex != null ? c.sdpMLineIndex : null,
            });
          });
        });
        return chain;
      });
  }

  function wireChannel(s, channel) {
    s.dc = channel;
    s.dc.onopen = function () {
      if (handlers.onOpen) handlers.onOpen();
    };
    s.dc.onclose = function () {
      if (handlers.onClose) handlers.onClose();
    };
    s.dc.onmessage = function (ev) {
      var text = typeof ev.data === "string" ? ev.data : "";
      s.pending.push(text);
      if (handlers.onMessage) handlers.onMessage(text);
    };
    if (s.dc.readyState === "open" && handlers.onOpen) handlers.onOpen();
  }

  function wirePcMedia(s, connection) {
    connection.ontrack = function (ev) {
      var remote = ensureRemoteStream(s);
      var track = ev.track;
      if (track && remote.addTrack) {
        try {
          remote.addTrack(track);
        } catch (e) {}
      }
      if (handlers.onTrack) handlers.onTrack(remote);
    };
  }

  function resetSession(s) {
    stopStream(s.localStream);
    stopStream(s.shareStream);
    s.localStream = null;
    s.shareStream = null;
    s.remoteStream = null;
    s.makingOffer = false;
    s.ignoreOffer = false;
    s.polite = false;
    if (s.dc) {
      try {
        s.dc.close();
      } catch (e) {}
    }
    if (s.pc) {
      try {
        s.pc.close();
      } catch (e) {}
    }
    s.pc = null;
    s.dc = null;
    s.ice = [];
    s.pending.length = 0;
  }

  function reset() {
    if (session) {
      resetSession(session);
      session = null;
    }
  }

  function setHandlers(next) {
    next = next || {};
    if (next.onMessage) handlers.onMessage = next.onMessage;
    if (next.onOpen) handlers.onOpen = next.onOpen;
    if (next.onClose) handlers.onClose = next.onClose;
    if (next.onTrack) handlers.onTrack = next.onTrack;
    var s = session;
    if (s && s.dc && s.dc.readyState === "open" && handlers.onOpen) {
      handlers.onOpen();
    }
  }

  function createInvite() {
    requireRtc();
    reset();
    var s = getSession();
    s.polite = false;
    s.pc = new RTCPeerConnection(iceConfig);
    attachIceListener(s, s.pc);
    wirePcMedia(s, s.pc);
    wireChannel(s, s.pc.createDataChannel("chat"));
    return s.pc
      .createOffer()
      .then(function (offer) {
        return s.pc.setLocalDescription(offer);
      })
      .then(function () {
        return waitIceComplete(s);
      })
      .then(function () {
        return encodeBundle(localBundle(s, "offer"));
      });
  }

  function acceptInvite(raw) {
    requireRtc();
    var bundle = parseBundle(raw);
    if (bundle.type !== "offer") {
      throw new Error("expected an offer invite");
    }
    reset();
    var s = getSession();
    s.polite = true;
    s.pc = new RTCPeerConnection(iceConfig);
    attachIceListener(s, s.pc);
    wirePcMedia(s, s.pc);
    s.pc.ondatachannel = function (ev) {
      wireChannel(s, ev.channel);
    };
    return applyRemote(s, bundle)
      .then(function () {
        return s.pc.createAnswer();
      })
      .then(function (answer) {
        return s.pc.setLocalDescription(answer);
      })
      .then(function () {
        return waitIceComplete(s);
      })
      .then(function () {
        return encodeBundle(localBundle(s, "answer"));
      });
  }

  function acceptReply(raw) {
    requireRtc();
    var s = getSession();
    if (!s.pc) throw new Error("no local session — create an invite first");
    var bundle = parseBundle(raw);
    if (bundle.type !== "answer") {
      throw new Error("expected an answer reply");
    }
    return applyRemote(s, bundle);
  }

  function send(text) {
    var s = getSession();
    if (!s.dc || s.dc.readyState !== "open") {
      throw new Error("data channel is not open");
    }
    s.dc.send(String(text));
  }

  function isOpen() {
    var s = session;
    return !!(s && s.dc && s.dc.readyState === "open");
  }

  function status() {
    var s = session;
    if (!s || !s.pc) {
      return {
        hasSession: false,
        open: false,
        dataChannel: "none",
        iceGathering: "none",
      };
    }
    return {
      hasSession: true,
      open: !!(s.dc && s.dc.readyState === "open"),
      dataChannel: s.dc ? s.dc.readyState : "none",
      iceGathering: s.pc.iceGatheringState,
      polite: s.polite,
    };
  }

  function getLocalStream() {
    return session && session.localStream;
  }

  function getRemoteStream() {
    return session ? ensureRemoteStream(session) : null;
  }

  function getShareStream() {
    return session && session.shareStream;
  }

  function addOrReplaceKind(s, stream, kind) {
    var track = stream.getTracks().find(function (t) {
      return t.kind === kind;
    });
    if (!track) return Promise.resolve();
    var senders = s.pc.getSenders ? s.pc.getSenders() : [];
    var existing = senders.find(function (sender) {
      return sender.track && sender.track.kind === kind;
    });
    if (existing && existing.replaceTrack) {
      return existing.replaceTrack(track);
    }
    if (s.pc.addTrack) s.pc.addTrack(track, stream);
    return Promise.resolve();
  }

  function startMicCam(opts) {
    var s = getSession();
    if (!s.pc) return Promise.reject(new Error("no local session"));
    var audio = !opts || opts.audio !== false;
    var video = !!(opts && opts.video);
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      return Promise.reject(new Error("getUserMedia is not available"));
    }
    return navigator.mediaDevices
      .getUserMedia({ audio: audio, video: video })
      .then(function (stream) {
        if (s.localStream) stopStream(s.localStream);
        s.localStream = stream;
        var chain = Promise.resolve();
        if (audio) {
          chain = chain.then(function () {
            return addOrReplaceKind(s, stream, "audio");
          });
        }
        if (video) {
          chain = chain.then(function () {
            return addOrReplaceKind(s, stream, "video");
          });
        }
        return chain;
      });
  }

  function startShare() {
    var s = getSession();
    if (!s.pc) return Promise.reject(new Error("no local session"));
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function"
    ) {
      return Promise.reject(new Error("getDisplayMedia is not available"));
    }
    return navigator.mediaDevices
      .getDisplayMedia({ video: true, audio: false })
      .then(function (stream) {
        stopStream(s.shareStream);
        s.shareStream = stream;
        var track = stream.getVideoTracks()[0];
        if (track && s.pc.addTrack) s.pc.addTrack(track, stream);
      });
  }

  function stopShare() {
    var s = getSession();
    stopStream(s.shareStream);
    s.shareStream = null;
    return Promise.resolve();
  }

  function stopMedia() {
    var s = getSession();
    if (s.pc && s.pc.getSenders) {
      s.pc.getSenders().forEach(function (sender) {
        if (sender.track) {
          try {
            sender.track.stop();
          } catch (e) {}
          if (sender.replaceTrack) {
            try {
              sender.replaceTrack(null);
            } catch (e2) {}
          }
        }
      });
    }
    stopStream(s.localStream);
    stopStream(s.shareStream);
    s.localStream = null;
    s.shareStream = null;
    s.remoteStream = null;
    return Promise.resolve();
  }

  function setMicEnabled(enabled) {
    var s = getSession();
    if (s.localStream) {
      s.localStream.getAudioTracks().forEach(function (t) {
        t.enabled = !!enabled;
      });
    }
  }

  function setCamEnabled(enabled) {
    var s = getSession();
    if (s.localStream) {
      s.localStream.getVideoTracks().forEach(function (t) {
        t.enabled = !!enabled;
      });
    }
  }

  function renegotiateOffer() {
    var s = getSession();
    if (!s.pc) return Promise.reject(new Error("no local session"));
    s.makingOffer = true;
    attachIceListener(s, s.pc);
    return s.pc
      .createOffer()
      .then(function (offer) {
        return s.pc.setLocalDescription(offer);
      })
      .then(function () {
        return waitIceComplete(s);
      })
      .then(function () {
        return encodeBundle(localBundle(s, "offer"));
      })
      .finally(function () {
        s.makingOffer = false;
      });
  }

  function acceptRemoteSdp(raw) {
    var s = getSession();
    if (!s.pc) return Promise.reject(new Error("no local session"));
    var bundle = parseBundle(raw);
    var offerCollision =
      bundle.type === "offer" &&
      (s.makingOffer || (s.pc.signalingState && s.pc.signalingState !== "stable"));
    s.ignoreOffer = !s.polite && offerCollision;
    if (s.ignoreOffer) {
      return Promise.resolve({ ignored: true });
    }
    var chain = Promise.resolve();
    if (offerCollision && s.polite && s.pc.setLocalDescription) {
      chain = chain.then(function () {
        return s.pc.setLocalDescription({ type: "rollback" });
      });
    }
    return chain
      .then(function () {
        return applyRemote(s, bundle);
      })
      .then(function () {
        if (bundle.type !== "offer") return { ok: true };
        attachIceListener(s, s.pc);
        return s.pc
          .createAnswer()
          .then(function (answer) {
            return s.pc.setLocalDescription(answer);
          })
          .then(function () {
            return waitIceComplete(s);
          })
          .then(function () {
            return encodeBundle(localBundle(s, "answer"));
          });
      });
  }

  return {
    ICE_PRESETS: ICE_PRESETS,
    setIcePreset: setIcePreset,
    setIceWaitMs: setIceWaitMs,
    listIcePresets: listIcePresets,
    encodeBundle: encodeBundle,
    parseBundle: parseBundle,
    createInvite: createInvite,
    acceptInvite: acceptInvite,
    acceptReply: acceptReply,
    send: send,
    isOpen: isOpen,
    status: status,
    setHandlers: setHandlers,
    reset: reset,
    startMicCam: startMicCam,
    startShare: startShare,
    stopShare: stopShare,
    stopMedia: stopMedia,
    setMicEnabled: setMicEnabled,
    setCamEnabled: setCamEnabled,
    renegotiateOffer: renegotiateOffer,
    acceptRemoteSdp: acceptRemoteSdp,
    getLocalStream: getLocalStream,
    getRemoteStream: getRemoteStream,
    getShareStream: getShareStream,
  };
});
