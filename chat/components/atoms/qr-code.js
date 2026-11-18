/**
 * Proxy for remote dimui QrCode — see dimui/src/components/atoms/qr-code.js
 */
BP.module(
  "chat/components/atoms/qr-code",
  ["dimui/components/atoms/qr-code"],
  function (mod) {
    return { QrCode: mod.QrCode };
  },
);
