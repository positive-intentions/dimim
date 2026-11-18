(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("frames encode decode and builders", async function () {
    var frames = await BP.require("chat/lib/frames");

    expect(frames.decode(null)).toBe(null);
    expect(frames.decode("")).toBe(null);
    expect(frames.decode("{")).toBe(null);
    expect(frames.decode("{}")).toBe(null);
    expect(frames.decode('{"type":"chat"}').type).toBe("chat");

    var hello = frames.decode(frames.hello({ displayName: "Ada", handle: "ada" }));
    expect(hello.type).toBe("hello");
    expect(hello.displayName).toBe("Ada");

    var chat = frames.decode(
      frames.chat({ id: "1", body: "hi", createdAt: "t" }),
    );
    expect(chat.body).toBe("hi");

    expect(frames.decode(frames.typing(true)).on).toBe(true);
    expect(frames.decode(frames.receipt("1", "read")).status).toBe("read");
    expect(frames.decode(frames.receipt("1", "delivered")).status).toBe(
      "delivered",
    );

    expect(frames.decode(frames.callInvite("video")).kind).toBe("video");
    expect(frames.decode(frames.callAccept("voice")).action).toBe("accept");
    expect(frames.decode(frames.callReject()).action).toBe("reject");
    expect(frames.decode(frames.callHangup()).action).toBe("hangup");

    var sdp = frames.decode(frames.callSdp("wu1:x"));
    expect(sdp.type).toBe("callSdp");
    expect(sdp.bundle).toBe("wu1:x");

    var offer = frames.decode(
      frames.fileOffer({
        id: "f1",
        name: "a.txt",
        mime: "text/plain",
        size: 3,
      }),
    );
    expect(offer.action).toBe("offer");
    expect(frames.decode(frames.fileChunk("f1", 0, 1, "YQ==")).data).toBe(
      "YQ==",
    );
    expect(frames.decode(frames.fileComplete("f1")).action).toBe("complete");
    expect(frames.decode(frames.fileCancel("f1")).action).toBe("cancel");
    expect(frames.fileChunkSize()).toBeGreaterThan(0);
    expect(frames.fileMaxBytes()).toBeGreaterThan(frames.fileChunkSize());
  });
})();
