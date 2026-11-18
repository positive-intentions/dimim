BP.module("chat/lib/vault", [], function () {
  const VAULT_FLAG = "dimim-vault";
  const VAULT_SENTINEL = "dimim";

  /**
   * Pure decision for the vault bootstrap effect in chat-shell.
   * @param {{ vaultValue: string, create: boolean, flagPresent: boolean }} opts
   * @returns {{ kind: "ready" | "wrong-password" | "seed" }}
   */
  function resolveVaultLoad(opts) {
    var vaultValue = opts && opts.vaultValue;
    var create = Boolean(opts && opts.create);
    var flagPresent = Boolean(opts && opts.flagPresent);

    if (vaultValue === VAULT_SENTINEL) {
      return { kind: "ready" };
    }
    if (!create && flagPresent) {
      return { kind: "wrong-password" };
    }
    return { kind: "seed" };
  }

  return { VAULT_FLAG, VAULT_SENTINEL, resolveVaultLoad };
});
