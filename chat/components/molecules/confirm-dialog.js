/**
 * Proxy for remote dimui ConfirmDialog — see dimui/src/components/molecules/confirm-dialog.js
 */
BP.module(
  "chat/components/molecules/confirm-dialog",
  ["dimui/components/molecules/confirm-dialog"],
  function (mod) {
    return { ConfirmDialog: mod.ConfirmDialog };
  },
);
