(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("mockData seeds and normalizers", async function () {
    var mock = await BP.require("chat/lib/mockData");
    expect(mock.ICE_PRESETS.length).toBeGreaterThan(1);
    expect(Array.isArray(mock.SEED_MESSAGES)).toBe(true);
    expect(mock.SEED_MESSAGES.length).toBe(0);

    var conn = mock.defaultConnection();
    expect(conn.phase).toBe("profile");
    expect(conn.transport).toBe("webrtc");
    expect(conn.localCode).toBe("");

    var profile = mock.normalizeProfile({
      displayName: "  Ada ",
      handle: "@Ada",
      icePreset: "nope",
      completed: 1,
    });
    expect(profile.displayName).toBe("Ada");
    expect(profile.handle).toBe("ada");
    expect(profile.icePreset).toBe("public");
    expect(profile.completed).toBe(true);

    expect(mock.normalizeProfile(null).displayName).toBe("");

    var normalized = mock.normalizeConnection({
      phase: "connected",
      transport: "webrtc",
      peer: { id: "1", displayName: "X", handle: "x" },
      localCode: "wu1:abc",
      statusBanner: "hi",
      role: "offerer",
    });
    expect(normalized.phase).toBe("connected");
    expect(normalized.transport).toBe("webrtc");
    expect(normalized.peer.handle).toBe("x");
    expect(normalized.role).toBe("offerer");

    var fallback = mock.normalizeConnection({ phase: "nope", peer: true });
    expect(fallback.phase).toBe("profile");
    expect(fallback.peer).toBe(null);
    expect(mock.normalizeConnection(null).localCode).toBe("");

    var answerer = mock.normalizeConnection({ role: "answerer" });
    expect(answerer.role).toBe("answerer");
  });
})();
