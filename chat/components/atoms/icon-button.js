/**
 * Proxy for remote dimui IconButton — see dimui/src/components/atoms/icon-button.js
 */
BP.module(
  "chat/components/atoms/icon-button",
  ["dimui/components/atoms/icon-button"],
  function (mod) {
    return { IconButton: mod.IconButton };
  },
);
