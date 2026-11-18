(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("pairing phase helpers", async function () {
    var pairing = await BP.require("chat/lib/pairing");
    var mock = await BP.require("chat/lib/mockData");
    var base = mock.defaultConnection();

    expect(pairing.canCompose(base)).toBe(false);
    var bad = pairing.afterProfileContinue(base, { displayName: "", handle: "" });
    expect(bad.ok).toBe(false);

    var ok = pairing.afterProfileContinue(base, {
      displayName: "Ada",
      handle: "ada",
    });
    expect(ok.ok).toBe(true);
    expect(ok.connection.phase).toBe("shareInvite");
    expect(ok.connection.transport).toBe("webrtc");

    var withInvite = pairing.withInviteCode(ok.connection, "wu1:offer");
    expect(withInvite.localCode).toBe("wu1:offer");
    expect(withInvite.phase).toBe("shareInvite");

    var withReply = pairing.withReplyCode(ok.connection, "wu1:answer");
    expect(withReply.phase).toBe("shareReply");
    expect(withReply.localCode).toBe("wu1:answer");

    var connecting = pairing.beginConnecting(ok.connection, "Working…");
    expect(connecting.phase).toBe("connecting");
    expect(connecting.statusBanner).toBe("Working…");

    var connected = pairing.finishConnected(connecting, {
      displayName: "Bo",
      handle: "bo",
    });
    expect(connected.phase).toBe("connected");
    expect(connected.peer.displayName).toBe("Bo");
    expect(connected.transport).toBe("webrtc");
    expect(pairing.canCompose(connected)).toBe(true);

    var disconnected = pairing.disconnect(connected, "wu1:new");
    expect(disconnected.phase).toBe("shareInvite");
    expect(disconnected.peer).toBe(null);
    expect(disconnected.localCode).toBe("wu1:new");

    var reset = pairing.resetToProfile(connected);
    expect(reset.phase).toBe("profile");
  });
})();
