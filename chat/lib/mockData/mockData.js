BP.module("chat/lib/mockData", [], function () {
  const ICE_PRESETS = [
    { id: "public", label: "Public STUN (redundant)" },
    { id: "google", label: "Google STUN" },
    { id: "cloudflare", label: "Cloudflare STUN" },
    { id: "openrelay", label: "OpenRelay STUN+TURN" },
  ];

  const DEFAULT_PROFILE = {
    displayName: "",
    handle: "",
    icePreset: "public",
    completed: false,
  };

  /** Empty seed — thread fills after a real peer connects. */
  const SEED_MESSAGES = [];

  function defaultConnection() {
    return {
      phase: "profile",
      transport: "webrtc",
      peer: null,
      localCode: "",
      statusBanner: "",
      role: null,
    };
  }

  function normalizeProfile(raw) {
    if (!raw || typeof raw !== "object") return { ...DEFAULT_PROFILE };
    const ice = ICE_PRESETS.some((p) => p.id === raw.icePreset)
      ? raw.icePreset
      : "public";
    return {
      displayName: String(raw.displayName || "").trim(),
      handle: String(raw.handle || "")
        .trim()
        .replace(/^@/, "")
        .toLowerCase(),
      icePreset: ice,
      completed: Boolean(raw.completed),
    };
  }

  function normalizeConnection(raw) {
    const base = defaultConnection();
    if (!raw || typeof raw !== "object") return base;
    const phases = [
      "profile",
      "shareInvite",
      "shareReply",
      "connecting",
      "connected",
    ];
    const phase = phases.indexOf(raw.phase) >= 0 ? raw.phase : base.phase;
    let peer = null;
    if (raw.peer && typeof raw.peer === "object") {
      peer = {
        id: String(raw.peer.id || raw.peer.handle || "peer"),
        displayName: String(raw.peer.displayName || "Peer"),
        handle: String(raw.peer.handle || ""),
      };
    }
    return {
      phase,
      transport: "webrtc",
      peer,
      localCode: String(raw.localCode || ""),
      statusBanner: String(raw.statusBanner || ""),
      role: raw.role === "answerer" ? "answerer" : raw.role === "offerer" ? "offerer" : null,
    };
  }

  return {
    ICE_PRESETS,
    DEFAULT_PROFILE,
    SEED_MESSAGES,
    defaultConnection,
    normalizeProfile,
    normalizeConnection,
  };
});
