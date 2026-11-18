(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  test("file-transfer base64 helpers", async function () {
    var ft = await BP.require("chat/lib/shell/file-transfer");
    var bytes = new Uint8Array([72, 105]);
    var b64 = ft.arrayBufferToBase64(bytes.buffer);
    expect(b64).toBe(btoa("Hi"));
    var back = ft.base64ToUint8(b64);
    expect(back[0]).toBe(72);
    expect(back[1]).toBe(105);
  });

  test("file-transfer inbound offer chunk complete cancel", async function () {
    var ft = await BP.require("chat/lib/shell/file-transfer");
    var frames = await BP.require("chat/lib/frames");
    var messages = [];
    var inbox = { current: {} };
    var deps = {
      incomingFilesRef: inbox,
      patchMessages: function (updater) {
        messages = updater(messages);
      },
    };

    var offer = frames.decode(
      frames.fileOffer({
        id: "f1",
        name: "a.txt",
        mime: "text/plain",
        size: 2,
      }),
    );
    ft.handleInboundFileFrame(offer, deps);
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe("f1");
    expect(messages[0].attachment.phase).toBe("receiving");
    expect(inbox.current.f1).toBeTruthy();

    var chunk = frames.decode(
      frames.fileChunk("f1", 0, 1, ft.arrayBufferToBase64(new Uint8Array([65, 66]).buffer)),
    );
    ft.handleInboundFileFrame(chunk, deps);
    expect(messages[0].attachment.progress).toBe(100);

    ft.handleInboundFileFrame(frames.decode(frames.fileComplete("f1")), deps);
    expect(messages[0].attachment.phase).toBe("complete");
    expect(messages[0].attachment.url).toBeTruthy();
    expect(inbox.current.f1).toBe(undefined);

    inbox.current = {};
    messages = [];
    ft.handleInboundFileFrame(offer, deps);
    ft.handleInboundFileFrame(frames.decode(frames.fileCancel("f1")), deps);
    expect(messages[0].attachment.phase).toBe("cancelled");
    expect(inbox.current.f1).toBe(undefined);

    ft.handleInboundFileFrame(
      frames.decode(frames.fileChunk("missing", 0, 1, "QQ==")),
      deps,
    );
    ft.handleInboundFileFrame(
      frames.decode(frames.fileComplete("missing")),
      deps,
    );
  });

  test("file-transfer outbound attach and cancel", async function () {
    var ft = await BP.require("chat/lib/shell/file-transfer");
    var frames = await BP.require("chat/lib/frames");
    var sent = [];
    var messages = [];
    var can = true;
    var api = ft.createFileTransfer({
      canCompose: function () {
        return can;
      },
      getConnection: function () {
        return {};
      },
      patchMessages: function (updater) {
        messages = updater(messages);
      },
      safeSend: function (payload) {
        sent.push(payload);
      },
    });

    can = false;
    api.handleAttach({ name: "x.bin", size: 1, type: "application/octet-stream" });
    expect(messages.length).toBe(0);

    can = true;
    api.handleAttach({
      name: "x.bin",
      size: frames.fileMaxBytes() + 1,
      type: "application/octet-stream",
    });
    expect(messages.length).toBe(0);

    api.handleAttach({
      name: "tiny.bin",
      size: 2,
      type: "application/octet-stream",
    });
    expect(messages.length).toBe(1);
    expect(sent.length).toBeGreaterThan(0);
    var offerFrame = frames.decode(sent[0]);
    expect(offerFrame.action).toBe("offer");
    expect(messages[0].attachment.phase).toBe("complete");

    var fileId = messages[0].id;
    api.handleCancelFile(fileId);
    expect(messages[0].attachment.phase).toBe("cancelled");

    sent = [];
    messages = [];
    var blob = {
      name: "ab.txt",
      size: 2,
      type: "text/plain",
      arrayBuffer: function () {
        return Promise.resolve(new Uint8Array([65, 66]).buffer);
      },
    };
    api.handleAttach(blob);
    await sleep(50);
    expect(messages[0].attachment.phase).toBe("complete");
    var types = sent.map(function (s) {
      return frames.decode(s).action;
    });
    expect(types.indexOf("offer") >= 0).toBe(true);
    expect(types.indexOf("chunk") >= 0).toBe(true);
    expect(types.indexOf("complete") >= 0).toBe(true);

    sent = [];
    messages = [];
    var bad = {
      name: "bad.bin",
      size: 1,
      type: "application/octet-stream",
      arrayBuffer: function () {
        return Promise.reject(new Error("read fail"));
      },
    };
    api.handleAttach(bad);
    await sleep(20);
    expect(messages[0].attachment.phase).toBe("failed");
  });
})();
