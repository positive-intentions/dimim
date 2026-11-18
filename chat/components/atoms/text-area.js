/**
 * Proxy for remote dimui TextArea — see dimui/src/components/atoms/text-area.js
 */
BP.module(
  "chat/components/atoms/text-area",
  ["dimui/components/atoms/text-area"],
  function (mod) {
    return { TextArea: mod.TextArea };
  },
);
