(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("theme proxy exposes getStoredTheme", async function () {
    var theme = await BP.require("chat/lib/theme");
    expect(typeof theme.getStoredTheme).toBe("function");
    expect(typeof theme.subscribeExplorerTheme).toBe("function");
  });
})();
