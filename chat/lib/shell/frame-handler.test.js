(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("frame-handler routes hello chat typing receipt call file", async function () {
    var mod = await BP.require("chat/lib/shell/frame-handler");
    var frames = await BP.require("chat/lib/frames");
    var mock = await BP.require("chat/lib/mockData");

    var connection = mock.defaultConnection();
    connection.phase = "connecting";
    var messages = [];
    var sent = [];
    var typing = false;
    var callFrames = [];
    var sdpFrames = [];
    var fileFrames = [];

    var handleFrame = mod.createFrameHandler({
      getConnection: function () {
        return connection;
      },
      setConnection: function (c) {
        connection = c;
      },
      patchMessages: function (updater) {
        messages = updater(messages);
      },
      safeSend: function (p) {
        sent.push(p);
      },
      setPeerTyping: function (v) {
        typing = v;
      },
      handleCallFrame: function (f) {
        callFrames.push(f);
      },
      handleCallSdpFrame: function (f) {
        sdpFrames.push(f);
      },
      handleInboundFileFrame: function (f) {
        fileFrames.push(f);
      },
    });

    handleFrame("");
    handleFrame("not-json");
    handleFrame(JSON.stringify({ nope: true }));

    handleFrame(
      frames.hello({ displayName: "Bo", handle: "bo" }),
    );
    expect(connection.phase).toBe("connected");
    expect(connection.peer.displayName).toBe("Bo");

    handleFrame(
      frames.chat({
        id: "m1",
        body: "hi",
        createdAt: "2020-01-01T00:00:00.000Z",
      }),
    );
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe("m1");
    expect(messages[0].status).toBe("delivered");
    expect(sent.length).toBe(2);

    handleFrame(frames.typing(true));
    expect(typing).toBe(true);
    handleFrame(frames.typing(false));
    expect(typing).toBe(false);

    messages = [
      {
        id: "m1",
        direction: "out",
        kind: "text",
        body: "hi",
        status: "sent",
        createdAt: "2020-01-01T00:00:00.000Z",
      },
    ];
    handleFrame(frames.receipt("m1", "read"));
    expect(messages[0].status).toBe("read");
    handleFrame(frames.receipt("m1", "delivered"));
    expect(messages[0].status).toBe("delivered");
    handleFrame(frames.receipt("other", "read"));
    expect(messages[0].status).toBe("delivered");

    handleFrame(frames.callInvite("video"));
    expect(callFrames.length).toBe(1);
    expect(callFrames[0].action).toBe("invite");

    handleFrame(frames.callSdp("bundle"));
    expect(sdpFrames.length).toBe(1);

    handleFrame(
      frames.fileOffer({
        id: "f1",
        name: "a.bin",
        mime: "application/octet-stream",
        size: 1,
      }),
    );
    expect(fileFrames.length).toBe(1);
    expect(fileFrames[0].action).toBe("offer");
  });
})();
