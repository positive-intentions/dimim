/**
 * Proxy for remote dimui OverflowMenu — see dimui/src/components/molecules/overflow-menu.js
 */
BP.module(
  "chat/components/molecules/overflow-menu",
  ["dimui/components/molecules/overflow-menu"],
  function (mod) {
    return { OverflowMenu: mod.OverflowMenu };
  },
);
