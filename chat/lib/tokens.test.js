(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("tokens exports chatTokens", async function () {
    var tokens = await BP.require("chat/lib/tokens");
    expect(Boolean(tokens.chatTokens)).toBe(true);
  });
})();
