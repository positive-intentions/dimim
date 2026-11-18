/**
 * Proxy for remote dimui IncomingCallBanner
 */
BP.module(
  "chat/components/molecules/incoming-call-banner",
  ["dimui/components/messaging/molecules/incoming-call-banner"],
  function (mod) {
    return { IncomingCallBanner: mod.IncomingCallBanner };
  },
);
