(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("qr-payload compress expand roundtrip", async function () {
    var mod = await BP.require("chat/lib/qr-payload");
    var short = "wu1:short-demo";
    var fittedShort = await mod.forQr(short);
    expect(fittedShort).toBe(short);
    expect(await mod.forQr("")).toBe("");

    // Build a long string that overflows raw QR capacity.
    var long =
      "wu1:" +
      btoa(
        Array(400)
          .fill('{"type":"offer","sdp":"v=0\\r\\no=- 1 1 IN IP4 127.0.0.1\\r\\n"}')
          .join(""),
      );
    expect(mod.canEncode(long, "L")).toBe(false);
    var fitted = await mod.forQr(long);
    expect(fitted.indexOf(mod.PREFIX_Z)).toBe(0);
    expect(mod.canEncode(fitted, "L") || mod.canEncode(fitted, "M")).toBe(true);
    var expanded = await mod.fromQr(fitted);
    expect(expanded).toBe(long);
    expect(await mod.fromQr(short)).toBe(short);

    // Error branches: missing compression APIs / still too long.
    var OrigCS = globalThis.CompressionStream;
    var OrigDS = globalThis.DecompressionStream;
    try {
      globalThis.CompressionStream = undefined;
      var threw = false;
      try {
        await mod.forQr(long);
      } catch (e) {
        threw =
          String(e && e.message ? e.message : e).indexOf("CompressionStream") >=
          0;
      }
      expect(threw).toBe(true);
    } finally {
      globalThis.CompressionStream = OrigCS;
    }
    try {
      globalThis.DecompressionStream = undefined;
      var threwInf = false;
      try {
        await mod.fromQr(fitted);
      } catch (e) {
        threwInf =
          String(e && e.message ? e.message : e).indexOf(
            "DecompressionStream",
          ) >= 0;
      }
      expect(threwInf).toBe(true);
    } finally {
      globalThis.DecompressionStream = OrigDS;
    }

    var origCan = mod.canEncode;
    mod.canEncode = function () {
      return false;
    };
    var threwLong = false;
    try {
      await mod.forQr(long);
    } catch (e) {
      threwLong =
        String(e && e.message ? e.message : e).indexOf("still too long") >= 0;
    }
    mod.canEncode = origCan;
    expect(threwLong).toBe(true);
  });
})();
