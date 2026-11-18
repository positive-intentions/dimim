/**
 * Proxy for remote dimui ChatThread
 */
BP.module(
  "chat/components/organisms/chat-thread",
  ["dimui/components/messaging/organisms/chat-thread"],
  function (mod) {
    return { ChatThread: mod.ChatThread };
  },
);
