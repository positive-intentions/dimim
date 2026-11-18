BP.module("chat/lib/pairing", ["chat/lib/mockData"], function (mock) {
  const { normalizeConnection } = mock;

  const PHASES = {
    profile: "profile",
    shareInvite: "shareInvite",
    shareReply: "shareReply",
    connecting: "connecting",
    connected: "connected",
  };

  function canCompose(connection) {
    const c = normalizeConnection(connection);
    return c.phase === PHASES.connected && Boolean(c.peer);
  }

  function afterProfileContinue(connection, profile) {
    const c = normalizeConnection(connection);
    const name = String((profile && profile.displayName) || "").trim();
    const handle = String((profile && profile.handle) || "")
      .trim()
      .replace(/^@/, "");
    if (!name || !handle) {
      return {
        ok: false,
        error: "Enter a display name and handle.",
        connection: c,
      };
    }
    return {
      ok: true,
      error: "",
      connection: {
        ...c,
        phase: PHASES.shareInvite,
        transport: "webrtc",
        statusBanner: "Share your invite code with a peer.",
      },
    };
  }

  function withInviteCode(connection, code) {
    const c = normalizeConnection(connection);
    return {
      ...c,
      phase: PHASES.shareInvite,
      localCode: String(code || ""),
      statusBanner: "Share your invite. Wait for their reply code.",
    };
  }

  function withReplyCode(connection, code) {
    const c = normalizeConnection(connection);
    return {
      ...c,
      phase: PHASES.shareReply,
      localCode: String(code || ""),
      statusBanner: "Show this reply code back to the inviter.",
    };
  }

  function beginConnecting(connection, banner) {
    const c = normalizeConnection(connection);
    return {
      ...c,
      phase: PHASES.connecting,
      statusBanner: banner || "Connecting…",
    };
  }

  function finishConnected(connection, peer) {
    const c = normalizeConnection(connection);
    return {
      ...c,
      phase: PHASES.connected,
      transport: "webrtc",
      peer: peer
        ? {
            id: String(peer.id || peer.handle || "peer"),
            displayName: String(peer.displayName || "Peer"),
            handle: String(peer.handle || ""),
          }
        : c.peer,
      statusBanner: "",
    };
  }

  function disconnect(connection, newCode) {
    const c = normalizeConnection(connection);
    return {
      ...c,
      phase: PHASES.shareInvite,
      peer: null,
      transport: "webrtc",
      localCode: String(newCode || ""),
      statusBanner: "Disconnected. Share a new invite.",
    };
  }

  function resetToProfile(connection) {
    const c = normalizeConnection(connection);
    return {
      ...c,
      phase: PHASES.profile,
      peer: null,
      localCode: "",
      statusBanner: "",
    };
  }

  return {
    PHASES,
    canCompose,
    afterProfileContinue,
    withInviteCode,
    withReplyCode,
    beginConnecting,
    finishConnected,
    disconnect,
    resetToProfile,
  };
});
