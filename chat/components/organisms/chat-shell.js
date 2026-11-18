BP.module(
  "chat/components/organisms/chat-shell",
  [
    "chat/lib/tokens",
    "chat/lib/vault",
    "chat/lib/mockData",
    "chat/lib/pairing",
    "chat/lib/messages",
    "chat/lib/frames",
    "chat/lib/peer",
    "chat/lib/qr-payload",
    "chat/components/templates/meet-layout",
  ],
  function (
    tokens,
    vault,
    mock,
    pairing,
    messagesLib,
    frames,
    peer,
    qrPayload,
    layout,
  ) {
    const { define, css } = Dim;
    const { chatTokens } = tokens;
    const { VAULT_FLAG, VAULT_SENTINEL } = vault;
    const {
      SEED_MESSAGES,
      DEFAULT_PROFILE,
      defaultConnection,
      normalizeProfile,
      normalizeConnection,
    } = mock;
    const {
      PHASES,
      canCompose,
      afterProfileContinue,
      withInviteCode,
      withReplyCode,
      beginConnecting,
      finishConnected,
      disconnect,
    } = pairing;
    const {
      normalizeMessages,
      createTextMessage,
      createFileMessage,
      updateAttachmentPhase,
      newId,
    } = messagesLib;
    const { MeetLayout } = layout;

    const shellStyles = css`
      ${chatTokens}

      .frame {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--chat-bg);
        color: var(--chat-text);
      }

      .status {
        padding: 2rem;
        text-align: center;
        color: var(--chat-text-muted);
      }
    `;

    function arrayBufferToBase64(buffer) {
      var bytes = new Uint8Array(buffer);
      var binary = "";
      for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    function base64ToUint8(b64) {
      var binary = atob(b64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    const ChatShell = define({
      tag: "dimim-chat-shell",
      component: (
        props,
        {
          html: tpl,
          useState: state,
          useEffect: effect,
          useStore: storeHook,
          useRef: ref,
          useScope: scope,
          useStyle: style,
        },
      ) => {
        style(shellStyles);
        scope({ MeetLayout });

        const password = props.password || "";
        const create = Boolean(props.create);
        const theme = props.theme === "light" ? "light" : "dark";
        const onLock =
          typeof props.onLock === "function" ? props.onLock : () => {};
        const onUnlockFailed =
          typeof props.onUnlockFailed === "function"
            ? props.onUnlockFailed
            : () => {};

        const store = storeHook(
          {
            vault: state(""),
            profile: state(DEFAULT_PROFILE),
            connection: state(defaultConnection()),
            messages: state([]),
          },
          { encryptionKey: password },
        );

        const [vaultValue, setVault, vaultLoading, , vaultSaving] = store.vault;
        const [profile, setProfile, profileLoading, , profileSaving] =
          store.profile;
        const [connection, setConnection, connectionLoading, , connectionSaving] =
          store.connection;
        const [messages, setMessages, messagesLoading, , messagesSaving] =
          store.messages;

        const [ready, setReady] = state(false);
        const [checked, setChecked] = state(false);
        const [peerTyping, setPeerTyping] = state(false);
        const [confirmClear, setConfirmClear] = state(false);
        const [minting, setMinting] = state(false);
        const [callOpen, setCallOpen] = state(false);
        const [callKind, setCallKind] = state("voice");
        const [callPhase, setCallPhase] = state("ringing");
        const [callMinimized, setCallMinimized] = state(false);
        const [incomingOpen, setIncomingOpen] = state(false);
        const [incomingKind, setIncomingKind] = state("voice");
        const [sharing, setSharing] = state(false);
        const [mediaTick, setMediaTick] = state(0);
        const hostRef = ref();
        const messagesRef = ref([]);
        const profileRef = ref(null);
        const connectionRef = ref(null);
        const incomingFilesRef = ref({});
        const helloSentRef = ref(false);

        const profileValue = normalizeProfile(profile);
        const connectionValue = normalizeConnection(connection);
        const messageList = normalizeMessages(messages);
        messagesRef.current = messageList;
        profileRef.current = profileValue;
        connectionRef.current = connectionValue;

        void profileLoading;
        void connectionLoading;
        void mediaTick;
        const loading = vaultLoading || messagesLoading;
        const isSaving = Boolean(
          vaultSaving || profileSaving || connectionSaving || messagesSaving,
        );

        effect(() => {
          const host = hostRef.current;
          if (host?.setAttribute) host.setAttribute("data-theme", theme);
        }, [theme]);

        effect(() => {
          if (loading || checked) return;

          if (vaultValue === VAULT_SENTINEL) {
            setReady(true);
            setChecked(true);
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(VAULT_FLAG, "1");
            }
            return;
          }

          if (
            !create &&
            typeof localStorage !== "undefined" &&
            localStorage.getItem(VAULT_FLAG) === "1"
          ) {
            setChecked(true);
            onUnlockFailed("Wrong password.");
            return;
          }

          setVault(VAULT_SENTINEL);
          setProfile({ ...DEFAULT_PROFILE });
          setConnection(defaultConnection());
          setMessages(SEED_MESSAGES);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(VAULT_FLAG, "1");
          }
          setReady(true);
          setChecked(true);
        }, [loading, vaultValue, create, checked]);

        const persistMessages = (next) => {
          const normalized = normalizeMessages(next);
          messagesRef.current = normalized;
          setMessages(normalized);
        };

        const patchMessages = (updater) => {
          const current = normalizeMessages(messagesRef.current || []);
          const next =
            typeof updater === "function" ? updater(current) : updater;
          persistMessages(next);
        };

        const safeSend = (payload) => {
          try {
            if (peer.isOpen()) peer.send(payload);
          } catch (e) {}
        };

        const bumpMedia = () => setMediaTick((n) => (n || 0) + 1);

        const handleFrame = (raw) => {
          const frame = frames.decode(raw);
          if (!frame) return;

          if (frame.type === "hello") {
            const peerInfo = {
              id: String(frame.handle || "peer"),
              displayName: String(frame.displayName || "Peer"),
              handle: String(frame.handle || ""),
            };
            const cur = connectionRef.current || connectionValue;
            setConnection(finishConnected(cur, peerInfo));
            return;
          }

          if (frame.type === "chat") {
            const msg = createTextMessage(frame.body || "", "in");
            msg.id = String(frame.id || msg.id);
            msg.createdAt = String(frame.createdAt || msg.createdAt);
            msg.status = "delivered";
            patchMessages((list) => [...list, msg]);
            safeSend(frames.receipt(msg.id, "delivered"));
            safeSend(frames.receipt(msg.id, "read"));
            return;
          }

          if (frame.type === "typing") {
            setPeerTyping(Boolean(frame.on));
            return;
          }

          if (frame.type === "receipt") {
            patchMessages((list) =>
              list.map((m) =>
                m.id === frame.id
                  ? {
                      ...m,
                      status:
                        frame.status === "read" ? "read" : "delivered",
                    }
                  : m,
              ),
            );
            return;
          }

          if (frame.type === "call") {
            if (frame.action === "invite") {
              setIncomingKind(frame.kind === "video" ? "video" : "voice");
              setIncomingOpen(true);
            } else if (frame.action === "accept") {
              setCallPhase("active");
              setCallOpen(true);
            } else if (frame.action === "reject" || frame.action === "hangup") {
              setIncomingOpen(false);
              setCallOpen(false);
              setCallPhase("ended");
              peer.stopMedia().then(bumpMedia).catch(function () {});
            }
            return;
          }

          if (frame.type === "callSdp" && frame.bundle) {
            peer
              .acceptRemoteSdp(frame.bundle)
              .then(function (result) {
                if (typeof result === "string" && result) {
                  safeSend(frames.callSdp(result));
                }
                bumpMedia();
              })
              .catch(function () {});
            return;
          }

          if (frame.type === "file") {
            const inbox = incomingFilesRef.current || {};
            if (frame.action === "offer") {
              const id = String(frame.id || newId());
              inbox[id] = {
                chunks: [],
                total: 0,
                name: frame.name || "file.bin",
                mime: frame.mime || "application/octet-stream",
                size: Number(frame.size) || 0,
              };
              incomingFilesRef.current = inbox;
              const msg = createFileMessage(
                {
                  name: inbox[id].name,
                  mime: inbox[id].mime,
                  size: inbox[id].size,
                },
                "in",
              );
              msg.id = id;
              msg.attachment.phase = "receiving";
              msg.attachment.progress = 0;
              patchMessages((list) => [...list, msg]);
            } else if (frame.action === "chunk") {
              const id = String(frame.id);
              const entry = inbox[id];
              if (!entry) return;
              entry.chunks[Number(frame.index) || 0] = frame.data || "";
              entry.total = Number(frame.total) || entry.total;
              const filled = entry.chunks.filter(Boolean).length;
              const pct = entry.total
                ? Math.round((filled / entry.total) * 100)
                : 0;
              patchMessages((list) =>
                list.map((m) =>
                  m.id === id
                    ? updateAttachmentPhase(m, "receiving", pct)
                    : m,
                ),
              );
            } else if (frame.action === "complete") {
              const id = String(frame.id);
              const entry = inbox[id];
              if (!entry) return;
              try {
                const parts = entry.chunks.map(base64ToUint8);
                let total = 0;
                parts.forEach(function (p) {
                  total += p.length;
                });
                const out = new Uint8Array(total);
                var offset = 0;
                parts.forEach(function (p) {
                  out.set(p, offset);
                  offset += p.length;
                });
                const blob = new Blob([out], { type: entry.mime });
                const url = URL.createObjectURL(blob);
                patchMessages((list) =>
                  list.map((m) => {
                    if (m.id !== id) return m;
                    const next = updateAttachmentPhase(m, "complete", 100);
                    next.body = entry.name;
                    next.attachment.url = url;
                    return next;
                  }),
                );
              } catch (e) {
                patchMessages((list) =>
                  list.map((m) =>
                    m.id === id ? updateAttachmentPhase(m, "failed", 0) : m,
                  ),
                );
              }
              delete inbox[id];
            } else if (frame.action === "cancel") {
              const id = String(frame.id);
              delete inbox[id];
              patchMessages((list) =>
                list.map((m) =>
                  m.id === id ? updateAttachmentPhase(m, "cancelled", 0) : m,
                ),
              );
            }
          }
        };

        const sendHello = () => {
          if (helloSentRef.current) return;
          helloSentRef.current = true;
          const p = profileRef.current || profileValue;
          safeSend(frames.hello(p));
          const cur = connectionRef.current || connectionValue;
          if (cur.phase !== PHASES.connected) {
            setConnection(
              beginConnecting(cur, "Connected — waiting for peer hello…"),
            );
          }
        };

        effect(() => {
          peer.setHandlers({
            onMessage: handleFrame,
            onOpen: sendHello,
            onClose: function () {
              helloSentRef.current = false;
            },
            onTrack: function () {
              bumpMedia();
            },
          });
          return () => {
            peer.reset();
            helloSentRef.current = false;
          };
        }, []);

        const mintInvite = (nextProfile) => {
          setMinting(true);
          peer.setIcePreset(nextProfile.icePreset || "public");
          peer
            .createInvite()
            .then(function (code) {
              const cur = connectionRef.current || connectionValue;
              setConnection({
                ...withInviteCode(cur, code),
                role: "offerer",
              });
              setMinting(false);
            })
            .catch(function (err) {
              setMinting(false);
              const cur = connectionRef.current || connectionValue;
              setConnection({
                ...cur,
                statusBanner:
                  "Failed to mint invite: " +
                  (err && err.message ? err.message : String(err)),
              });
            });
        };

        const handleProfileContinue = (fields) => {
          const nextProfile = normalizeProfile({
            ...profileValue,
            ...fields,
            completed: true,
          });
          const result = afterProfileContinue(connectionValue, nextProfile);
          if (!result.ok) return result;
          setProfile(nextProfile);
          setConnection({ ...result.connection, role: "offerer" });
          mintInvite(nextProfile);
          return result;
        };

        const handlePasteCode = (code) => {
          const raw = String(code || "").trim();
          if (!raw) {
            return { ok: false, error: "Paste a peer code." };
          }

          const applyTrimmed = (trimmed) => {
            let bundle;
            try {
              bundle = peer.parseBundle(trimmed);
            } catch (e) {
              return {
                ok: false,
                error: e && e.message ? e.message : "Invalid code",
              };
            }

            const cur = connectionRef.current || connectionValue;
            const failPaste = (prefix, err) => {
              setConnection({
                ...cur,
                phase: PHASES.shareInvite,
                statusBanner:
                  prefix + (err && err.message ? err.message : String(err)),
              });
            };

            if (bundle.type === "offer") {
              setConnection(
                beginConnecting(
                  { ...cur, role: "answerer" },
                  "Accepting invite…",
                ),
              );
              peer.setIcePreset(profileValue.icePreset || "public");
              peer
                .acceptInvite(trimmed)
                .then(function (reply) {
                  setConnection({
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
              setConnection(beginConnecting(cur, "Finishing handshake…"));
              peer
                .acceptReply(trimmed)
                .then(function () {
                  setConnection(
                    beginConnecting(cur, "Waiting for data channel…"),
                  );
                })
                .catch(function (err) {
                  failPaste("Reply failed: ", err);
                });
              return { ok: true, error: "" };
            }

            return { ok: false, error: "Unknown signaling type." };
          };

          if (raw.indexOf(qrPayload.PREFIX_Z) === 0) {
            qrPayload
              .fromQr(raw)
              .then(function (expanded) {
                const result = applyTrimmed(String(expanded || "").trim());
                if (!result.ok) {
                  const cur = connectionRef.current || connectionValue;
                  setConnection({
                    ...cur,
                    phase: PHASES.shareInvite,
                    statusBanner: result.error || "Invalid code",
                  });
                }
              })
              .catch(function (err) {
                const cur = connectionRef.current || connectionValue;
                setConnection({
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
        };

        const handleSend = (text) => {
          if (!canCompose(connectionRef.current || connectionValue)) return;
          const msg = createTextMessage(text, "out");
          if (!msg || !msg.body) return;
          patchMessages((list) => [...list, msg]);
          safeSend(frames.chat(msg));
        };

        const handleTyping = (on) => {
          if (!peer.isOpen()) return;
          safeSend(frames.typing(on));
        };

        const handleAttach = (fileMeta, fileObj) => {
          if (!canCompose(connectionRef.current || connectionValue)) return;
          const file = fileObj || fileMeta;
          const size = Number(file && file.size) || 0;
          if (size > frames.fileMaxBytes()) {
            return;
          }
          const msg = createFileMessage(
            {
              name: (file && file.name) || "file.bin",
              size: size,
              mime: (file && file.type) || "application/octet-stream",
            },
            "out",
          );
          patchMessages((list) => [...list, msg]);
          safeSend(
            frames.fileOffer({
              id: msg.id,
              name: msg.attachment.name,
              mime: msg.attachment.mime,
              size: msg.attachment.size,
            }),
          );

          const sendChunks = (buffer) => {
            const bytes = new Uint8Array(buffer);
            const chunkSize = frames.fileChunkSize();
            const total = Math.max(1, Math.ceil(bytes.length / chunkSize) || 1);
            var i = 0;
            function sendNext() {
              if (i >= total) {
                safeSend(frames.fileComplete(msg.id));
                patchMessages((list) =>
                  list.map((m) =>
                    m.id === msg.id
                      ? updateAttachmentPhase(m, "complete", 100)
                      : m,
                  ),
                );
                return;
              }
              const slice = bytes.subarray(i * chunkSize, (i + 1) * chunkSize);
              safeSend(
                frames.fileChunk(
                  msg.id,
                  i,
                  total,
                  arrayBufferToBase64(
                    slice.buffer.slice(
                      slice.byteOffset,
                      slice.byteOffset + slice.byteLength,
                    ),
                  ),
                ),
              );
              const pct = Math.round(((i + 1) / total) * 100);
              patchMessages((list) =>
                list.map((m) =>
                  m.id === msg.id
                    ? updateAttachmentPhase(m, "sending", pct)
                    : m,
                ),
              );
              i += 1;
              setTimeout(sendNext, 0);
            }
            patchMessages((list) =>
              list.map((m) =>
                m.id === msg.id
                  ? updateAttachmentPhase(m, "sending", 0)
                  : m,
              ),
            );
            sendNext();
          };

          if (file && typeof file.arrayBuffer === "function") {
            file.arrayBuffer().then(sendChunks).catch(function () {
              patchMessages((list) =>
                list.map((m) =>
                  m.id === msg.id
                    ? updateAttachmentPhase(m, "failed", 0)
                    : m,
                ),
              );
            });
          } else {
            patchMessages((list) =>
              list.map((m) =>
                m.id === msg.id
                  ? updateAttachmentPhase(m, "complete", 100)
                  : m,
              ),
            );
            safeSend(frames.fileComplete(msg.id));
          }
        };

        const handleCancelFile = (id) => {
          safeSend(frames.fileCancel(id));
          patchMessages((list) =>
            list.map((m) =>
              m.id === id ? updateAttachmentPhase(m, "cancelled", 0) : m,
            ),
          );
        };

        const failCall = (err) => {
          setCallPhase(
            "error: " + (err && err.message ? err.message : String(err)),
          );
        };

        const startOutboundCall = (kind) => {
          const k = kind === "video" ? "video" : "voice";
          setIncomingOpen(false);
          setCallKind(k);
          setCallPhase("ringing");
          setCallMinimized(false);
          setCallOpen(true);
          peer
            .startMicCam({ audio: true, video: k === "video" })
            .then(function () {
              bumpMedia();
              safeSend(frames.callInvite(k));
              return peer.renegotiateOffer();
            })
            .then(function (offer) {
              safeSend(frames.callSdp(offer));
              setCallPhase("active");
            })
            .catch(failCall);
        };

        const endCall = () => {
          safeSend(frames.callHangup());
          setCallOpen(false);
          setCallPhase("ended");
          setCallMinimized(false);
          setSharing(false);
          peer.stopMedia().then(bumpMedia).catch(function () {});
        };

        const acceptIncoming = () => {
          const k = incomingKind === "video" ? "video" : "voice";
          setIncomingOpen(false);
          setCallKind(k);
          setCallPhase("connecting");
          setCallOpen(true);
          peer
            .startMicCam({ audio: true, video: k === "video" })
            .then(function () {
              bumpMedia();
              safeSend(frames.callAccept(k));
              setCallPhase("active");
            })
            .catch(failCall);
        };

        const declineIncoming = () => {
          setIncomingOpen(false);
          safeSend(frames.callReject());
        };

        const clearHistory = () => {
          persistMessages([]);
          setConfirmClear(false);
        };

        const handleDisconnect = () => {
          endCall();
          setIncomingOpen(false);
          helloSentRef.current = false;
          peer.reset();
          const next = disconnect(connectionValue, "");
          setConnection(next);
          mintInvite(profileValue);
        };

        if (!ready || loading) {
          return tpl`
            <div class="frame" data-theme="${theme}" ref=${hostRef}>
              <div class="status">
                ${loading ? "Decrypting…" : "Opening vault…"}
              </div>
            </div>
          `;
        }

        const connected = connectionValue.phase === PHASES.connected;
        void isSaving;

        return tpl`
          <div class="frame" data-theme="${theme}" ref=${hostRef}>
            <dimim-meet-layout
              .props="${{
                theme,
                connected,
                pairingProps: {
                  theme,
                  phase: connectionValue.phase,
                  profile: profileValue,
                  localCode: connectionValue.localCode,
                  statusBanner: connectionValue.statusBanner,
                  minting,
                  onProfileContinue: handleProfileContinue,
                  onPasteCode: handlePasteCode,
                },
                threadProps: {
                  theme,
                  peer: connectionValue.peer || {},
                  connected,
                  online: connected && peer.isOpen(),
                  typing: peerTyping,
                  messages: messageList,
                  incomingOpen,
                  incomingKind,
                  onSend: handleSend,
                  onAttach: handleAttach,
                  onTyping: handleTyping,
                  onVoice: () => startOutboundCall("voice"),
                  onVideo: () => startOutboundCall("video"),
                  onLock,
                  onCancelFile: handleCancelFile,
                  onAcceptIncoming: acceptIncoming,
                  onDeclineIncoming: declineIncoming,
                  menuItems: [
                    {
                      label: "Clear history",
                      danger: true,
                      onClick: () => setConfirmClear(true),
                    },
                    {
                      label: "Disconnect",
                      danger: true,
                      onClick: handleDisconnect,
                    },
                  ],
                },
                callProps: {
                  open: callOpen,
                  peer: connectionValue.peer || {},
                  kind: callKind,
                  phase: callPhase,
                  minimized: callMinimized,
                  sharing,
                  localStream: peer.getLocalStream(),
                  remoteStream: peer.getRemoteStream(),
                  onEnd: endCall,
                  onToggleMinimize: () => setCallMinimized(!callMinimized),
                  onToggleMute: (enabled) => peer.setMicEnabled(enabled),
                  onToggleCamera: (enabled) => peer.setCamEnabled(enabled),
                  onToggleShare: () => {
                    if (sharing) {
                      peer
                        .stopShare()
                        .then(function () {
                          setSharing(false);
                          return peer.renegotiateOffer();
                        })
                        .then(function (offer) {
                          if (offer) safeSend(frames.callSdp(offer));
                          bumpMedia();
                        })
                        .catch(function () {});
                    } else {
                      peer
                        .startShare()
                        .then(function () {
                          setSharing(true);
                          return peer.renegotiateOffer();
                        })
                        .then(function (offer) {
                          if (offer) safeSend(frames.callSdp(offer));
                          bumpMedia();
                        })
                        .catch(failCall);
                    }
                  },
                },
                confirmProps: {
                  open: confirmClear,
                  title: "Clear history?",
                  body: "This wipes messages in this browser vault only. The link stays up.",
                  confirmLabel: "Clear",
                  onConfirm: clearHistory,
                  onCancel: () => setConfirmClear(false),
                },
              }}"
            />
          </div>
        `;
      },
    });

    return { ChatShell };
  },
);
