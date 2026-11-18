/**
 * Proxy for remote dimui Badge — see dimui/src/components/atoms/badge.js
 */
BP.module(
  "chat/components/atoms/badge",
  ["dimui/components/atoms/badge"],
  function (mod) {
    return { Badge: mod.Badge };
  },
);
