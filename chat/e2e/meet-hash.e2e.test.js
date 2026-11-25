(function () {
  var e2e = DimTest.e2e || DimTest.test;
  var expect = DimTest.expect;
  var H = DimimE2E;

  e2e("e2e: continue profile keeps #/pair hash", async function () {
    var page = await H.openPeer("hash-a");
    await H.createVault(page, "pass1234");
    await H.waitShellReady(page);
    await page.wait(function () {
      return H.hashPathname(page) === "/pair" ? true : null;
    }, 10000);
    await H.completeProfile(page, "Ada", "ada");
    await page.wait(function () {
      return H.hashPathname(page) === "/pair" ? true : null;
    }, 10000);
    expect(H.hashPathname(page)).toBe("/pair");
    H.closeAllPeers();
  });

  e2e("e2e: hash after unlock opens profile (deep link)", async function () {
    var page = await H.openPeer("hash-b");
    await H.createVault(page, "pass1234");
    await H.waitShellReady(page);
    await H.completeProfile(page, "Ada", "ada");
    await H.setHash(page, "/profile");
    await page.wait(function () {
      return page.query("dimui-profile") || null;
    }, 15000);
    expect(H.hashPathname(page)).toBe("/profile");
    expect((page.text("dimui-profile") || "").indexOf("My profile") >= 0).toBe(
      true,
    );
    H.closeAllPeers();
  });
})();
