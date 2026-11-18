/**
 * Proxy for remote dimui Overlay — see dimui/src/components/atoms/overlay.js
 */
BP.module(
  "chat/components/atoms/overlay",
  ["dimui/components/atoms/overlay"],
  function (mod) {
    return { Overlay: mod.Overlay };
  },
);
