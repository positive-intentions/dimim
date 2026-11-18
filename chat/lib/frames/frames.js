BP.module("chat/lib/frames", ["chat/lib/messages"], function (messages) {
  var newId = messages.newId;

  function encode(frame) {
    return JSON.stringify(frame);
  }

  function decode(raw) {
    if (raw == null || String(raw).trim() === "") return null;
    try {
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object" || !obj.type) return null;
      return obj;
    } catch (e) {
      return null;
    }
  }

  function hello(profile) {
    return encode({
      type: "hello",
      displayName: String((profile && profile.displayName) || ""),
      handle: String((profile && profile.handle) || ""),
    });
  }

  function chat(msg) {
    return encode({
      type: "chat",
      id: msg.id,
      body: msg.body,
      createdAt: msg.createdAt,
    });
  }

  function typing(on) {
    return encode({ type: "typing", on: Boolean(on) });
  }

  function receipt(id, status) {
    return encode({
      type: "receipt",
      id: String(id),
      status: status === "read" ? "read" : "delivered",
    });
  }

  function callInvite(kind) {
    return encode({
      type: "call",
      action: "invite",
      kind: kind === "video" ? "video" : "voice",
    });
  }

  function callAccept(kind) {
    return encode({
      type: "call",
      action: "accept",
      kind: kind === "video" ? "video" : "voice",
    });
  }

  function callReject() {
    return encode({ type: "call", action: "reject" });
  }

  function callHangup() {
    return encode({ type: "call", action: "hangup" });
  }

  function callSdp(bundle) {
    return encode({
      type: "callSdp",
      bundle: typeof bundle === "string" ? bundle : JSON.stringify(bundle),
    });
  }

  function fileOffer(meta) {
    return encode({
      type: "file",
      action: "offer",
      id: meta.id || newId(),
      name: meta.name || "file.bin",
      mime: meta.mime || "application/octet-stream",
      size: Number(meta.size) || 0,
    });
  }

  function fileChunk(id, index, total, data) {
    return encode({
      type: "file",
      action: "chunk",
      id: String(id),
      index: Number(index) || 0,
      total: Number(total) || 1,
      data: String(data || ""),
    });
  }

  function fileComplete(id) {
    return encode({ type: "file", action: "complete", id: String(id) });
  }

  function fileCancel(id) {
    return encode({ type: "file", action: "cancel", id: String(id) });
  }

  var FILE_CHUNK = 12 * 1024;
  var FILE_MAX = 12 * 1024 * 1024;

  function fileChunkSize() {
    return FILE_CHUNK;
  }

  function fileMaxBytes() {
    return FILE_MAX;
  }

  return {
    encode: encode,
    decode: decode,
    hello: hello,
    chat: chat,
    typing: typing,
    receipt: receipt,
    callInvite: callInvite,
    callAccept: callAccept,
    callReject: callReject,
    callHangup: callHangup,
    callSdp: callSdp,
    fileOffer: fileOffer,
    fileChunk: fileChunk,
    fileComplete: fileComplete,
    fileCancel: fileCancel,
    fileChunkSize: fileChunkSize,
    fileMaxBytes: fileMaxBytes,
  };
});
