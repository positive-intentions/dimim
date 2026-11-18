BP.module(
  "chat/lib/shell/file-transfer",
  ["chat/lib/frames", "chat/lib/messages"],
  function (frames, messagesLib) {
    var createFileMessage = messagesLib.createFileMessage;
    var updateAttachmentPhase = messagesLib.updateAttachmentPhase;
    var newId = messagesLib.newId;

    function arrayBufferToBase64(buffer) {
      var bytes = new Uint8Array(buffer);
      var binary = "";
      for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    function base64ToUint8(b64) {
      var binary = atob(b64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    /**
     * Handle inbound file frames (offer / chunk / complete / cancel).
     * @param {object} frame
     * @param {{ incomingFilesRef: { current: object }, patchMessages: Function }} deps
     */
    function handleInboundFileFrame(frame, deps) {
      var incomingFilesRef = deps.incomingFilesRef;
      var patchMessages = deps.patchMessages;
      var inbox = incomingFilesRef.current || {};

      if (frame.action === "offer") {
        var id = String(frame.id || newId());
        inbox[id] = {
          chunks: [],
          total: 0,
          name: frame.name || "file.bin",
          mime: frame.mime || "application/octet-stream",
          size: Number(frame.size) || 0,
        };
        incomingFilesRef.current = inbox;
        var msg = createFileMessage(
          {
            name: inbox[id].name,
            mime: inbox[id].mime,
            size: inbox[id].size,
          },
          "in",
        );
        msg.id = id;
        msg.attachment.phase = "receiving";
        msg.attachment.progress = 0;
        patchMessages(function (list) {
          return list.concat([msg]);
        });
        return;
      }

      if (frame.action === "chunk") {
        var chunkId = String(frame.id);
        var entry = inbox[chunkId];
        if (!entry) return;
        entry.chunks[Number(frame.index) || 0] = frame.data || "";
        entry.total = Number(frame.total) || entry.total;
        var filled = entry.chunks.filter(Boolean).length;
        var pct = entry.total
          ? Math.round((filled / entry.total) * 100)
          : 0;
        patchMessages(function (list) {
          return list.map(function (m) {
            return m.id === chunkId
              ? updateAttachmentPhase(m, "receiving", pct)
              : m;
          });
        });
        return;
      }

      if (frame.action === "complete") {
        var completeId = String(frame.id);
        var completeEntry = inbox[completeId];
        if (!completeEntry) return;
        try {
          var parts = completeEntry.chunks.map(base64ToUint8);
          var total = 0;
          parts.forEach(function (p) {
            total += p.length;
          });
          var out = new Uint8Array(total);
          var offset = 0;
          parts.forEach(function (p) {
            out.set(p, offset);
            offset += p.length;
          });
          var blob = new Blob([out], { type: completeEntry.mime });
          var url = URL.createObjectURL(blob);
          patchMessages(function (list) {
            return list.map(function (m) {
              if (m.id !== completeId) return m;
              var next = updateAttachmentPhase(m, "complete", 100);
              next.body = completeEntry.name;
              next.attachment.url = url;
              return next;
            });
          });
        } catch (e) {
          patchMessages(function (list) {
            return list.map(function (m) {
              return m.id === completeId
                ? updateAttachmentPhase(m, "failed", 0)
                : m;
            });
          });
        }
        delete inbox[completeId];
        return;
      }

      if (frame.action === "cancel") {
        var cancelId = String(frame.id);
        delete inbox[cancelId];
        patchMessages(function (list) {
          return list.map(function (m) {
            return m.id === cancelId
              ? updateAttachmentPhase(m, "cancelled", 0)
              : m;
          });
        });
      }
    }

    /**
     * @param {{
     *   canCompose: Function,
     *   getConnection: Function,
     *   patchMessages: Function,
     *   safeSend: Function
     * }} deps
     */
    function createFileTransfer(deps) {
      function handleAttach(fileMeta, fileObj) {
        if (!deps.canCompose(deps.getConnection())) return;
        var file = fileObj || fileMeta;
        var size = Number(file && file.size) || 0;
        if (size > frames.fileMaxBytes()) {
          return;
        }
        var msg = createFileMessage(
          {
            name: (file && file.name) || "file.bin",
            size: size,
            mime: (file && file.type) || "application/octet-stream",
          },
          "out",
        );
        deps.patchMessages(function (list) {
          return list.concat([msg]);
        });
        deps.safeSend(
          frames.fileOffer({
            id: msg.id,
            name: msg.attachment.name,
            mime: msg.attachment.mime,
            size: msg.attachment.size,
          }),
        );

        function sendChunks(buffer) {
          var bytes = new Uint8Array(buffer);
          var chunkSize = frames.fileChunkSize();
          var total = Math.max(1, Math.ceil(bytes.length / chunkSize) || 1);
          var i = 0;
          function sendNext() {
            if (i >= total) {
              deps.safeSend(frames.fileComplete(msg.id));
              deps.patchMessages(function (list) {
                return list.map(function (m) {
                  return m.id === msg.id
                    ? updateAttachmentPhase(m, "complete", 100)
                    : m;
                });
              });
              return;
            }
            var slice = bytes.subarray(i * chunkSize, (i + 1) * chunkSize);
            deps.safeSend(
              frames.fileChunk(
                msg.id,
                i,
                total,
                arrayBufferToBase64(
                  slice.buffer.slice(
                    slice.byteOffset,
                    slice.byteOffset + slice.byteLength,
                  ),
                ),
              ),
            );
            var progress = Math.round(((i + 1) / total) * 100);
            deps.patchMessages(function (list) {
              return list.map(function (m) {
                return m.id === msg.id
                  ? updateAttachmentPhase(m, "sending", progress)
                  : m;
              });
            });
            i += 1;
            setTimeout(sendNext, 0);
          }
          deps.patchMessages(function (list) {
            return list.map(function (m) {
              return m.id === msg.id
                ? updateAttachmentPhase(m, "sending", 0)
                : m;
            });
          });
          sendNext();
        }

        if (file && typeof file.arrayBuffer === "function") {
          file.arrayBuffer().then(sendChunks).catch(function () {
            deps.patchMessages(function (list) {
              return list.map(function (m) {
                return m.id === msg.id
                  ? updateAttachmentPhase(m, "failed", 0)
                  : m;
              });
            });
          });
        }
        if (!(file && typeof file.arrayBuffer === "function")) {
          deps.patchMessages(function (list) {
            return list.map(function (m) {
              return m.id === msg.id
                ? updateAttachmentPhase(m, "complete", 100)
                : m;
            });
          });
          deps.safeSend(frames.fileComplete(msg.id));
        }
      }

      function handleCancelFile(id) {
        deps.safeSend(frames.fileCancel(id));
        deps.patchMessages(function (list) {
          return list.map(function (m) {
            return m.id === id
              ? updateAttachmentPhase(m, "cancelled", 0)
              : m;
          });
        });
      }

      return {
        handleAttach: handleAttach,
        handleCancelFile: handleCancelFile,
        handleInboundFileFrame: function (frame) {
          handleInboundFileFrame(frame, deps);
        },
      };
    }

    return {
      arrayBufferToBase64: arrayBufferToBase64,
      base64ToUint8: base64ToUint8,
      handleInboundFileFrame: handleInboundFileFrame,
      createFileTransfer: createFileTransfer,
    };
  },
);
