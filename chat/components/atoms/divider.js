/**
 * Proxy for remote dimui Divider — see dimui/src/components/atoms/divider.js
 */
BP.module(
  "chat/components/atoms/divider",
  ["dimui/components/atoms/divider"],
  function (mod) {
    return { Divider: mod.Divider };
  },
);
