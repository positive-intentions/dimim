/**
 * Proxy for remote dimui messaging helpers.
 * Protocol/shell code continues to BP.require("chat/lib/messages").
 */
BP.module(
  "chat/lib/messages",
  ["dimui/lib/messaging/messages"],
  function (mod) {
    return mod;
  },
);
