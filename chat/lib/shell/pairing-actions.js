BP.module(
  "chat/lib/shell/pairing-actions",
  [
    "chat/lib/pairing",
    "chat/lib/mockData",
    "chat/lib/frames",
    "chat/lib/qr-payload",
  ],
  function (pairing, mock, frames, qrPayload) {
    var PHASES = pairing.PHASES;
    var afterProfileContinue = pairing.afterProfileContinue;
    var withInviteCode = pairing.withInviteCode;
    var withReplyCode = pairing.withReplyCode;
    var beginConnecting = pairing.beginConnecting;
    var disconnect = pairing.disconnect;
    var normalizeProfile = mock.normalizeProfile;

    /**
     * @param {{
     *   peer: object,
     *   safeSend: Function,
     *   getProfile: Function,
     *   getConnection: Function,
     *   setProfile: Function,
     *   setConnection: Function,
     *   setMinting: Function,
     *   setIncomingOpen: Function,
     *   helloSentRef: { current: boolean },
     *   endCall: Function
     * }} deps
     */
    function createPairingActions(deps) {
      function mintInvite(nextProfile) {
        deps.setMinting(true);
        deps.peer.setIcePreset(nextProfile.icePreset || "public");
        deps.peer
          .createInvite()
          .then(function (code) {
            var cur = deps.getConnection();
            deps.setConnection({
              ...withInviteCode(cur, code),
              role: "offerer",
            });
            deps.setMinting(false);
          })
          .catch(function (err) {
            deps.setMinting(false);
            var cur = deps.getConnection();
            deps.setConnection({
              ...cur,
              statusBanner:
                "Failed to mint invite: " +
                (err && err.message ? err.message : String(err)),
            });
          });
      }

      function handleProfileContinue(fields) {
        var profileValue = deps.getProfile();
        var connectionValue = deps.getConnection();
        var nextProfile = normalizeProfile({
          ...profileValue,
          ...fields,
          completed: true,
        });
        var result = afterProfileContinue(connectionValue, nextProfile);
        if (!result.ok) return result;
        deps.setProfile(nextProfile);
        deps.setConnection({ ...result.connection, role: "offerer" });
        mintInvite(nextProfile);
        return result;
      }

      function applyTrimmed(trimmed) {
        var bundle;
        try {
          bundle = deps.peer.parseBundle(trimmed);
        } catch (e) {
          return {
            ok: false,
            error: e && e.message ? e.message : "Invalid code",
          };
        }

        var cur = deps.getConnection();
        var profileValue = deps.getProfile();

        function failPaste(prefix, err) {
          deps.setConnection({
            ...cur,
            phase: PHASES.shareInvite,
            statusBanner:
              prefix + (err && err.message ? err.message : String(err)),
          });
        }

        if (bundle.type === "offer") {
          deps.setConnection(
            beginConnecting(
              { ...cur, role: "answerer" },
              "Accepting invite…",
            ),
          );
          deps.peer.setIcePreset(profileValue.icePreset || "public");
          deps.peer
            .acceptInvite(trimmed)
            .then(function (reply) {
              deps.setConnection({
                ...withReplyCode(cur, reply),
                role: "answerer",
              });
            })
            .catch(function (err) {
              failPaste("Accept failed: ", err);
            });
          return { ok: true, error: "" };
        }

        if (bundle.type === "answer") {
          deps.setConnection(beginConnecting(cur, "Finishing handshake…"));
          deps.peer
            .acceptReply(trimmed)
            .then(function () {
              deps.setConnection(
                beginConnecting(cur, "Waiting for data channel…"),
              );
            })
            .catch(function (err) {
              failPaste("Reply failed: ", err);
            });
          return { ok: true, error: "" };
        }

        return { ok: false, error: "Unknown signaling type." };
      }

      function handlePasteCode(code) {
        var raw = String(code || "").trim();
        if (!raw) {
          return { ok: false, error: "Paste a peer code." };
        }

        if (raw.indexOf(qrPayload.PREFIX_Z) === 0) {
          qrPayload
            .fromQr(raw)
            .then(function (expanded) {
              var result = applyTrimmed(String(expanded || "").trim());
              if (!result.ok) {
                var cur = deps.getConnection();
                deps.setConnection({
                  ...cur,
                  phase: PHASES.shareInvite,
                  statusBanner: result.error || "Invalid code",
                });
              }
            })
            .catch(function (err) {
              var cur = deps.getConnection();
              deps.setConnection({
                ...cur,
                phase: PHASES.shareInvite,
                statusBanner:
                  "QR expand failed: " +
                  (err && err.message ? err.message : String(err)),
              });
            });
          return { ok: true, error: "" };
        }

        return applyTrimmed(raw);
      }

      function sendHello() {
        if (deps.helloSentRef.current) return;
        deps.helloSentRef.current = true;
        var p = deps.getProfile();
        deps.safeSend(frames.hello(p));
        var cur = deps.getConnection();
        if (cur.phase !== PHASES.connected) {
          deps.setConnection(
            beginConnecting(cur, "Connected — waiting for peer hello…"),
          );
        }
      }

      function handleDisconnect() {
        deps.endCall();
        deps.setIncomingOpen(false);
        deps.helloSentRef.current = false;
        deps.peer.reset();
        var next = disconnect(deps.getConnection(), "");
        deps.setConnection(next);
        mintInvite(deps.getProfile());
      }

      return {
        mintInvite: mintInvite,
        handleProfileContinue: handleProfileContinue,
        handlePasteCode: handlePasteCode,
        sendHello: sendHello,
        handleDisconnect: handleDisconnect,
      };
    }

    return { createPairingActions: createPairingActions };
  },
);
