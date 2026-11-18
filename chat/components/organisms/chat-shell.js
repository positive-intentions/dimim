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
    "chat/lib/shell/frame-handler",
    "chat/lib/shell/pairing-actions",
    "chat/lib/shell/file-transfer",
    "chat/lib/shell/call-session",
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
    frameHandlerLib,
    pairingActionsLib,
    fileTransferLib,
    callSessionLib,
    layout,
  ) {
    const { define, css } = Dim;
    const { chatTokens } = tokens;
    const { VAULT_FLAG, VAULT_SENTINEL, resolveVaultLoad } = vault;
    const {
      SEED_MESSAGES,
      DEFAULT_PROFILE,
      defaultConnection,
      normalizeProfile,
      normalizeConnection,
    } = mock;
    const { PHASES, canCompose } = pairing;
    const { normalizeMessages, createTextMessage } = messagesLib;
    const { MeetLayout } = layout;
    const { createFrameHandler } = frameHandlerLib;
    const { createPairingActions } = pairingActionsLib;
    const { createFileTransfer } = fileTransferLib;
    const { createCallSession } = callSessionLib;

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

          const flagPresent =
            typeof localStorage !== "undefined" &&
            localStorage.getItem(VAULT_FLAG) === "1";
          const decision = resolveVaultLoad({
            vaultValue,
            create,
            flagPresent,
          });

          if (decision.kind === "ready") {
            setReady(true);
            setChecked(true);
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(VAULT_FLAG, "1");
            }
            return;
          }

          if (decision.kind === "wrong-password") {
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

        const getConnection = () => connectionRef.current || connectionValue;
        const getProfile = () => profileRef.current || profileValue;

        const calls = createCallSession({
          peer,
          safeSend,
          bumpMedia,
          getIncomingKind: () => incomingKind,
          getSharing: () => sharing,
          setCallOpen,
          setCallKind,
          setCallPhase,
          setCallMinimized,
          setIncomingOpen,
          setIncomingKind,
          setSharing,
        });

        const files = createFileTransfer({
          canCompose,
          getConnection,
          patchMessages,
          safeSend,
          incomingFilesRef,
        });

        const pairingApi = createPairingActions({
          peer,
          safeSend,
          getProfile,
          getConnection,
          setProfile,
          setConnection,
          setMinting,
          setIncomingOpen,
          helloSentRef,
          endCall: calls.endCall,
        });

        const handleFrame = createFrameHandler({
          getConnection,
          setConnection,
          patchMessages,
          safeSend,
          setPeerTyping,
          handleCallFrame: calls.handleCallFrame,
          handleCallSdpFrame: calls.handleCallSdpFrame,
          handleInboundFileFrame: files.handleInboundFileFrame,
        });

        effect(() => {
          peer.setHandlers({
            onMessage: handleFrame,
            onOpen: pairingApi.sendHello,
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

        const handleSend = (text) => {
          if (!canCompose(getConnection())) return;
          const msg = createTextMessage(text, "out");
          if (!msg || !msg.body) return;
          patchMessages((list) => [...list, msg]);
          safeSend(frames.chat(msg));
        };

        const handleTyping = (on) => {
          if (!peer.isOpen()) return;
          safeSend(frames.typing(on));
        };

        const clearHistory = () => {
          persistMessages([]);
          setConfirmClear(false);
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
                  onProfileContinue: pairingApi.handleProfileContinue,
                  onPasteCode: pairingApi.handlePasteCode,
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
                  onAttach: files.handleAttach,
                  onTyping: handleTyping,
                  onVoice: () => calls.startOutboundCall("voice"),
                  onVideo: () => calls.startOutboundCall("video"),
                  onLock,
                  onCancelFile: files.handleCancelFile,
                  onAcceptIncoming: calls.acceptIncoming,
                  onDeclineIncoming: calls.declineIncoming,
                  menuItems: [
                    {
                      label: "Clear history",
                      danger: true,
                      onClick: () => setConfirmClear(true),
                    },
                    {
                      label: "Disconnect",
                      danger: true,
                      onClick: pairingApi.handleDisconnect,
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
                  onEnd: calls.endCall,
                  onToggleMinimize: () => setCallMinimized(!callMinimized),
                  onToggleMute: (enabled) => peer.setMicEnabled(enabled),
                  onToggleCamera: (enabled) => peer.setCamEnabled(enabled),
                  onToggleShare: calls.toggleShare,
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
