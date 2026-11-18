/**
 * Proxy for remote dimui ChatHeader
 */
BP.module(
  "chat/components/molecules/chat-header",
  ["dimui/components/messaging/molecules/chat-header"],
  function (mod) {
    return { ChatHeader: mod.ChatHeader };
  },
);
