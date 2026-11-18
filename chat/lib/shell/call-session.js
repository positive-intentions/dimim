BP.module(
  "chat/lib/shell/call-session",
  ["chat/lib/frames"],
  function (frames) {
    /**
     * @param {{
     *   peer: object,
     *   safeSend: Function,
     *   bumpMedia: Function,
     *   getIncomingKind: Function,
     *   getSharing: Function,
     *   setCallOpen: Function,
     *   setCallKind: Function,
     *   setCallPhase: Function,
     *   setCallMinimized: Function,
     *   setIncomingOpen: Function,
     *   setIncomingKind: Function,
     *   setSharing: Function
     * }} deps
     */
    function createCallSession(deps) {
      function failCall(err) {
        deps.setCallPhase(
          "error: " + (err && err.message ? err.message : String(err)),
        );
      }

      function startOutboundCall(kind) {
        var k = kind === "video" ? "video" : "voice";
        deps.setIncomingOpen(false);
        deps.setCallKind(k);
        deps.setCallPhase("ringing");
        deps.setCallMinimized(false);
        deps.setCallOpen(true);
        deps.peer
          .startMicCam({ audio: true, video: k === "video" })
          .then(function () {
            deps.bumpMedia();
            deps.safeSend(frames.callInvite(k));
            return deps.peer.renegotiateOffer();
          })
          .then(function (offer) {
            deps.safeSend(frames.callSdp(offer));
            deps.setCallPhase("active");
          })
          .catch(failCall);
      }

      function endCall() {
        deps.safeSend(frames.callHangup());
        deps.setCallOpen(false);
        deps.setCallPhase("ended");
        deps.setCallMinimized(false);
        deps.setSharing(false);
        deps.peer.stopMedia().then(deps.bumpMedia).catch(function () {});
      }

      function acceptIncoming() {
        var k =
          deps.getIncomingKind() === "video" ? "video" : "voice";
        deps.setIncomingOpen(false);
        deps.setCallKind(k);
        deps.setCallPhase("connecting");
        deps.setCallOpen(true);
        deps.peer
          .startMicCam({ audio: true, video: k === "video" })
          .then(function () {
            deps.bumpMedia();
            deps.safeSend(frames.callAccept(k));
            deps.setCallPhase("active");
          })
          .catch(failCall);
      }

      function declineIncoming() {
        deps.setIncomingOpen(false);
        deps.safeSend(frames.callReject());
      }

      function toggleShare() {
        if (deps.getSharing()) {
          deps.peer
            .stopShare()
            .then(function () {
              deps.setSharing(false);
              return deps.peer.renegotiateOffer();
            })
            .then(function (offer) {
              if (offer) deps.safeSend(frames.callSdp(offer));
              deps.bumpMedia();
            })
            .catch(function () {});
          return;
        }
        deps.peer
          .startShare()
          .then(function () {
            deps.setSharing(true);
            return deps.peer.renegotiateOffer();
          })
          .then(function (offer) {
            if (offer) deps.safeSend(frames.callSdp(offer));
            deps.bumpMedia();
          })
          .catch(failCall);
      }

      function handleCallFrame(frame) {
        if (frame.action === "invite") {
          deps.setIncomingKind(frame.kind === "video" ? "video" : "voice");
          deps.setIncomingOpen(true);
          return;
        }
        if (frame.action === "accept") {
          deps.setCallPhase("active");
          deps.setCallOpen(true);
          return;
        }
        if (frame.action === "reject" || frame.action === "hangup") {
          deps.setIncomingOpen(false);
          deps.setCallOpen(false);
          deps.setCallPhase("ended");
          deps.peer.stopMedia().then(deps.bumpMedia).catch(function () {});
        }
      }

      function handleCallSdpFrame(frame) {
        if (!frame.bundle) return;
        deps.peer
          .acceptRemoteSdp(frame.bundle)
          .then(function (result) {
            if (typeof result === "string" && result) {
              deps.safeSend(frames.callSdp(result));
            }
            deps.bumpMedia();
          })
          .catch(function () {});
      }

      return {
        failCall: failCall,
        startOutboundCall: startOutboundCall,
        endCall: endCall,
        acceptIncoming: acceptIncoming,
        declineIncoming: declineIncoming,
        toggleShare: toggleShare,
        handleCallFrame: handleCallFrame,
        handleCallSdpFrame: handleCallSdpFrame,
      };
    }

    return { createCallSession: createCallSession };
  },
);
