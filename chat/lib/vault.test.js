(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("vault exports flag and sentinel", async function () {
    var vault = await BP.require("chat/lib/vault");
    expect(vault.VAULT_FLAG).toBe("dimim-vault");
    expect(vault.VAULT_SENTINEL).toBe("dimim");
  });
})();
