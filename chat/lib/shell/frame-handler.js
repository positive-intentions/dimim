BP.module(
  "chat/lib/shell/frame-handler",
  ["chat/lib/frames", "chat/lib/messages", "chat/lib/pairing"],
  function (frames, messagesLib, pairing) {
    var createTextMessage = messagesLib.createTextMessage;
    var finishConnected = pairing.finishConnected;

    /**
     * @param {{
     *   getConnection: Function,
     *   setConnection: Function,
     *   patchMessages: Function,
     *   safeSend: Function,
     *   setPeerTyping: Function,
     *   handleCallFrame: Function,
     *   handleCallSdpFrame: Function,
     *   handleInboundFileFrame: Function
     * }} deps
     */
    function createFrameHandler(deps) {
      return function handleFrame(raw) {
        var frame = frames.decode(raw);
        if (!frame) return;

        if (frame.type === "hello") {
          var peerInfo = {
            id: String(frame.handle || "peer"),
            displayName: String(frame.displayName || "Peer"),
            handle: String(frame.handle || ""),
          };
          var cur = deps.getConnection();
          deps.setConnection(finishConnected(cur, peerInfo));
          return;
        }

        if (frame.type === "chat") {
          var msg = createTextMessage(frame.body || "", "in");
          msg.id = String(frame.id || msg.id);
          msg.createdAt = String(frame.createdAt || msg.createdAt);
          msg.status = "delivered";
          deps.patchMessages(function (list) {
            return list.concat([msg]);
          });
          deps.safeSend(frames.receipt(msg.id, "delivered"));
          deps.safeSend(frames.receipt(msg.id, "read"));
          return;
        }

        if (frame.type === "typing") {
          deps.setPeerTyping(Boolean(frame.on));
          return;
        }

        if (frame.type === "receipt") {
          deps.patchMessages(function (list) {
            return list.map(function (m) {
              if (m.id !== frame.id) return m;
              return {
                ...m,
                status: frame.status === "read" ? "read" : "delivered",
              };
            });
          });
          return;
        }

        if (frame.type === "call") {
          deps.handleCallFrame(frame);
          return;
        }

        if (frame.type === "callSdp") {
          deps.handleCallSdpFrame(frame);
          return;
        }

        if (frame.type === "file") {
          deps.handleInboundFileFrame(frame);
        }
      };
    }

    return { createFrameHandler: createFrameHandler };
  },
);
