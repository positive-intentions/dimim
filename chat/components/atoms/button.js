/**
 * Proxy for remote dimui Button — see dimui/src/components/atoms/button.js
 */
BP.module(
  "chat/components/atoms/button",
  ["dimui/components/atoms/button"],
  function (mod) {
    return { Button: mod.Button };
  },
);
