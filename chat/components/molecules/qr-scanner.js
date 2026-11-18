/**
 * Proxy for remote dimui QrScanner — see dimui/src/components/molecules/qr-scanner.js
 */
BP.module(
  "chat/components/molecules/qr-scanner",
  ["dimui/components/molecules/qr-scanner"],
  function (mod) {
    return { QrScanner: mod.QrScanner };
  },
);
