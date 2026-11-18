/**
 * Proxy for remote dimui Avatar — see dimui/src/components/atoms/avatar.js
 */
BP.module(
  "chat/components/atoms/avatar",
  ["dimui/components/atoms/avatar"],
  function (mod) {
    return { Avatar: mod.Avatar };
  },
);
