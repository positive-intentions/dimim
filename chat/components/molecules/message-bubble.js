/**
 * Proxy for remote dimui MessageBubble
 */
BP.module(
  "chat/components/molecules/message-bubble",
  ["dimui/components/messaging/molecules/message-bubble"],
  function (mod) {
    return { MessageBubble: mod.MessageBubble };
  },
);
