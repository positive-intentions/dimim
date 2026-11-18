(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("vault exports flag and sentinel", async function () {
    var vault = await BP.require("chat/lib/vault");
    expect(vault.VAULT_FLAG).toBe("dimim-vault");
    expect(vault.VAULT_SENTINEL).toBe("dimim");
  });

  test("vault resolveVaultLoad decisions", async function () {
    var vault = await BP.require("chat/lib/vault");

    expect(
      vault.resolveVaultLoad({
        vaultValue: vault.VAULT_SENTINEL,
        create: false,
        flagPresent: true,
      }).kind,
    ).toBe("ready");

    expect(
      vault.resolveVaultLoad({
        vaultValue: "",
        create: false,
        flagPresent: true,
      }).kind,
    ).toBe("wrong-password");

    expect(
      vault.resolveVaultLoad({
        vaultValue: "",
        create: true,
        flagPresent: true,
      }).kind,
    ).toBe("seed");

    expect(
      vault.resolveVaultLoad({
        vaultValue: "",
        create: false,
        flagPresent: false,
      }).kind,
    ).toBe("seed");

    expect(vault.resolveVaultLoad(null).kind).toBe("seed");
  });
})();
