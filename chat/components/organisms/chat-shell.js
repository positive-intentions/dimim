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
    "chat/lib/meet-url",
    "chat/components/templates/meet-layout",
    "dimurl/components/router",
    "dimurl/components/route",
    "dimurl/hooks/use-params",
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
    meetUrl,
    layout,
    routerMod,
    routeMod,
    paramsMod,
  ) {
    const { define, css } = Dim;
    const { chatTokens } = tokens;
    const { VAULT_FLAG, VAULT_SENTINEL, resolveVaultLoad } = vault;
    const {
      SEED_MESSAGES,
      DEFAULT_PROFILE,
      ICE_PRESETS,
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
    const { Router } = routerMod;
    const { Route } = routeMod;
    const { useNavigate, useLocation } = paramsMod;
    const { SCREENS, toLocation, fromLocation } = meetUrl;

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
        scope({ MeetLayout, Router, Route });

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
        const [screen, setScreen] = state(SCREENS.pair);
        const [profileError, setProfileError] = state("");
        const hostRef = ref();
        const messagesRef = ref([]);
        const profileRef = ref(null);
        const connectionRef = ref(null);
        const incomingFilesRef = ref({});
        const helloSentRef = ref(false);
        const unpairingRef = ref(false);
        const applyingUrlRef = ref(false);
        const screenRef = ref(SCREENS.pair);

        const navigate = useNavigate({ useRef: ref });
        const loc = useLocation({
          useState: state,
          useEffect: effect,
          useRef: ref,
        });

        const profileValue = normalizeProfile(profile);
        const connectionValue = normalizeConnection(connection);
        const messageList = normalizeMessages(messages);
        messagesRef.current = messageList;
        profileRef.current = profileValue;
        connectionRef.current = connectionValue;
        screenRef.current = screen;

        void profileLoading;
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

        const writeUrl = (nextScreen, mode) => {
          const path = toLocation({ screen: nextScreen });
          if (mode === "replace") navigate(path, { replace: true });
          else navigate(path);
        };

        const baseScreenForConnection = (conn) => {
          const c = normalizeConnection(conn);
          return c.phase === PHASES.connected ? SCREENS.chat : SCREENS.pair;
        };

        const applyFromPath = (pathname, conn) => {
          const c = normalizeConnection(conn);
          const connected = c.phase === PHASES.connected;
          const parsed = fromLocation(pathname || "/");
          let next = parsed.screen;

          applyingUrlRef.current = true;

          if (!next) {
            next = connected ? SCREENS.chat : SCREENS.pair;
            setScreen(next);
            applyingUrlRef.current = false;
            writeUrl(next, "replace");
            return;
          }

          if (next === SCREENS.chat && !connected) {
            next = SCREENS.pair;
            setScreen(next);
            applyingUrlRef.current = false;
            writeUrl(next, "replace");
            return;
          }

          if (next === SCREENS.pair && connected) {
            next = SCREENS.chat;
            setScreen(next);
            applyingUrlRef.current = false;
            writeUrl(next, "replace");
            return;
          }

          if (next === SCREENS.contact && !c.peer) {
            next = connected ? SCREENS.chat : SCREENS.pair;
            setScreen(next);
            applyingUrlRef.current = false;
            writeUrl(next, "replace");
            return;
          }

          setScreen(next);
          applyingUrlRef.current = false;

          const expected = toLocation({ screen: next });
          if ((pathname || "/") !== expected) {
            writeUrl(next, "replace");
          }
        };

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
          unpairingRef,
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

        const handlePeerClosed = () => {
          helloSentRef.current = false;
          if (unpairingRef.current) return;
          const cur = getConnection();
          // Only unpair after a completed handshake. ICE/PC failures during
          // minting or connecting must not wipe a live invite/reply QR.
          if (cur.phase !== PHASES.connected) return;
          pairingApi.handleDisconnect();
          writeUrl(SCREENS.pair, "replace");
        };

        effect(() => {
          peer.setHandlers({
            onMessage: handleFrame,
            onOpen: pairingApi.sendHello,
            onClose: handlePeerClosed,
            onTrack: function () {
              bumpMedia();
            },
          });
          return () => {
            peer.reset();
            helloSentRef.current = false;
          };
        }, []);

        // Persisted connected without a live data channel → unpair + remint.
        effect(() => {
          if (!ready || loading || connectionLoading) return undefined;
          const cur = connectionRef.current || connectionValue;
          if (cur.phase === PHASES.connected && !peer.isOpen()) {
            pairingApi.handleDisconnect();
            writeUrl(SCREENS.pair, "replace");
          }
          return undefined;
        }, [ready, loading, connectionLoading, connectionValue.phase]);

        // Drive screen from router pathname (hash → UI).
        effect(() => {
          if (!ready || loading) return undefined;
          if (applyingUrlRef.current) return undefined;
          applyFromPath(loc.pathname, connectionRef.current);
          return undefined;
        }, [ready, loading, loc.pathname]);

        // Keep hash in sync when vault connection phase changes.
        effect(() => {
          if (!ready || loading) return undefined;
          if (applyingUrlRef.current) return undefined;
          const connected = connectionValue.phase === PHASES.connected;
          const current = screenRef.current;
          if (connected && current === SCREENS.pair) {
            writeUrl(SCREENS.chat, "replace");
          } else if (
            !connected &&
            (current === SCREENS.chat || current === SCREENS.contact)
          ) {
            writeUrl(SCREENS.pair, "replace");
          }
          return undefined;
        }, [ready, loading, connectionValue.phase, connectionValue.peer]);

        // Pair screen without a live RTC session → mint a fresh invite.
        effect(() => {
          if (!ready || loading || connectionLoading) return undefined;
          if (screen !== SCREENS.pair) return undefined;
          pairingApi.ensureFreshInvite();
          return undefined;
        }, [ready, loading, connectionLoading, screen, connectionValue.phase]);

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

        const goBackFromOverlay = () => {
          writeUrl(baseScreenForConnection(getConnection()));
        };

        const openProfile = () => {
          setProfileError("");
          writeUrl(SCREENS.profile);
        };

        const openContact = () => {
          if (!getConnection().peer) return;
          writeUrl(SCREENS.contact);
        };

        const saveProfile = (fields) => {
          setProfileError("");
          const nextProfile = normalizeProfile({
            ...getProfile(),
            ...fields,
            completed: true,
          });
          if (!nextProfile.displayName || !nextProfile.handle) {
            setProfileError("Enter a display name and handle.");
            return;
          }
          setProfile(nextProfile);
          if (peer.isOpen()) {
            helloSentRef.current = false;
            pairingApi.sendHello();
          }
          writeUrl(baseScreenForConnection(getConnection()));
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
            <dimurl-router>
              <dimurl-route path="/pair"></dimurl-route>
              <dimurl-route path="/chat"></dimurl-route>
              <dimurl-route path="/profile"></dimurl-route>
              <dimurl-route path="/contact"></dimurl-route>
              <dimim-meet-layout
                .props="${{
                  theme,
                  activeScreen: screen,
                  pairingProps: {
                    theme,
                    phase: connectionValue.phase,
                    profile: profileValue,
                    localCode: connectionValue.localCode,
                    statusBanner: connectionValue.statusBanner,
                    minting,
                    onProfileContinue: pairingApi.handleProfileContinue,
                    onPasteCode: pairingApi.handlePasteCode,
                    onRemint: () => pairingApi.mintInvite(getProfile()),
                    onEditProfile: profileValue.completed ? openProfile : null,
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
                    onPeerClick: openContact,
                    onCancelFile: files.handleCancelFile,
                    onAcceptIncoming: calls.acceptIncoming,
                    onDeclineIncoming: calls.declineIncoming,
                    menuItems: [
                      {
                        label: "My profile",
                        onClick: openProfile,
                      },
                      {
                        label: "Contact info",
                        onClick: openContact,
                      },
                      {
                        label: "Clear history",
                        danger: true,
                        onClick: () => setConfirmClear(true),
                      },
                      {
                        label: "Disconnect",
                        danger: true,
                        onClick: () => {
                          pairingApi.handleDisconnect();
                          writeUrl(SCREENS.pair, "replace");
                        },
                      },
                    ],
                  },
                  profileProps: {
                    theme,
                    profile: profileValue,
                    icePresets: ICE_PRESETS,
                    error: profileError,
                    onBack: goBackFromOverlay,
                    onSave: saveProfile,
                  },
                  contactProps: {
                    theme,
                    contact: connectionValue.peer,
                    online: connected && peer.isOpen(),
                    onBack: goBackFromOverlay,
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
            </dimurl-router>
          </div>
        `;
      },
    });

    return { ChatShell };
  },
);
