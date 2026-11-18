(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("share-code findQrSvg and readLivePaste", async function () {
    var sc = await BP.require("chat/lib/share-code");
    expect(sc.findQrSvg(null)).toBe(null);

    var host = document.createElement("div");
    expect(sc.findQrSvg(host)).toBe(null);

    var qr = document.createElement("div");
    qr.attachShadow({ mode: "open" });
    Object.defineProperty(host, "querySelector", {
      value: function (sel) {
        if (sel === "dimui-qr-code") return qr;
        return null;
      },
    });
    expect(sc.findQrSvg(host)).toBe(null);

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    qr.shadowRoot.appendChild(svg);
    expect(sc.findQrSvg(host)).toBe(svg);

    var badHost = {
      querySelector: function () {
        throw new Error("boom");
      },
    };
    expect(sc.findQrSvg(badHost)).toBe(null);

    expect(sc.readLivePaste(null, "fallback")).toBe("fallback");

    var row = document.createElement("div");
    var field = document.createElement("div");
    field.attachShadow({ mode: "open" });
    var input = document.createElement("input");
    input.value = "live-value";
    field.shadowRoot.appendChild(input);
    Object.defineProperty(row, "querySelector", {
      value: function (sel) {
        if (sel === "dimui-text-field") return field;
        return null;
      },
    });
    expect(sc.readLivePaste(row, "fallback")).toBe("live-value");

    input.value = "";
    expect(sc.readLivePaste(row, "fallback")).toBe("fallback");

    var boomRow = {
      querySelector: function () {
        throw new Error("x");
      },
    };
    expect(sc.readLivePaste(boomRow, "fallback")).toBe("fallback");
  });

  test("share-code createQrExport and decodeUploadedQr", async function () {
    var sc = await BP.require("chat/lib/share-code");
    var calls = { download: [], share: [] };
    var qrPng = {
      pngBlobFromSvg: async function () {
        return new Blob(["png"], { type: "image/png" });
      },
      downloadPng: function (blob, name) {
        calls.download.push({ blob: blob, name: name });
        return "ok";
      },
      sharePng: async function (blob, name, title) {
        calls.share.push({ blob: blob, name: name, title: title });
        return "ok";
      },
    };
    var api = sc.createQrExport({ qrPng: qrPng, filename: "x.png" });

    var noSvg = await api.rasterize(document.createElement("div"));
    expect(noSvg.blob).toBe(null);
    expect(noSvg.hint).toBe(sc.HINT_QR_NOT_READY);

    var host = document.createElement("div");
    var qr = document.createElement("div");
    qr.attachShadow({ mode: "open" });
    qr.shadowRoot.appendChild(
      document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    );
    Object.defineProperty(host, "querySelector", {
      value: function () {
        return qr;
      },
    });

    var ok = await api.rasterize(host);
    expect(ok.blob).toBeTruthy();

    qrPng.pngBlobFromSvg = async function () {
      throw new Error("fail");
    };
    var fail = await api.rasterize(host);
    expect(fail.hint).toBe(sc.HINT_QR_NOT_READY);

    var notReady = await api.save(host, false, false);
    expect(notReady.hint).toBe(sc.HINT_QR_NOT_READY);

    qrPng.pngBlobFromSvg = async function () {
      return new Blob(["png"], { type: "image/png" });
    };
    var saved = await api.save(host, true, false);
    expect(saved.hint).toBe("");
    expect(calls.download[0].name).toBe("x.png");

    qrPng.downloadPng = function () {
      return "unsupported";
    };
    var unsupported = await api.save(host, true, true);
    expect(unsupported.hint.indexOf("Share QR")).toBeGreaterThan(-1);
    var unsupportedNoShare = await api.save(host, true, false);
    expect(unsupportedNoShare.hint.indexOf("screenshot")).toBeGreaterThan(-1);

    qrPng.pngBlobFromSvg = async function () {
      throw new Error("fail");
    };
    var saveNoBlob = await api.save(host, true, false);
    expect(saveNoBlob.hint).toBe(sc.HINT_QR_NOT_READY);

    var shareNotReady = await api.share(host, false);
    expect(shareNotReady.hint).toBe(sc.HINT_QR_NOT_READY);

    qrPng.pngBlobFromSvg = async function () {
      return new Blob(["png"], { type: "image/png" });
    };
    qrPng.sharePng = async function () {
      return "ok";
    };
    expect((await api.share(host, true)).hint).toBe("");

    qrPng.sharePng = async function () {
      return "abort";
    };
    expect((await api.share(host, true)).hint).toBe("");

    qrPng.sharePng = async function () {
      return "gesture";
    };
    expect((await api.share(host, true)).hint.indexOf("again")).toBeGreaterThan(
      -1,
    );

    qrPng.sharePng = async function () {
      return "fail";
    };
    expect((await api.share(host, true)).hint.indexOf("Save QR")).toBeGreaterThan(
      -1,
    );

    qrPng.sharePng = async function () {
      return "unsupported";
    };
    expect((await api.share(host, true)).hint.indexOf("Save QR")).toBeGreaterThan(
      -1,
    );

    qrPng.pngBlobFromSvg = async function () {
      throw new Error("fail");
    };
    expect((await api.share(host, true)).hint).toBe(sc.HINT_QR_NOT_READY);

    var empty = await sc.decodeUploadedQr(null, {
      decodeImageFile: async function () {
        return "x";
      },
    });
    expect(empty.text).toBe(null);

    var decoded = await sc.decodeUploadedQr(
      { name: "a.png" },
      {
        decodeImageFile: async function () {
          return "wu1:code";
        },
      },
    );
    expect(decoded.text).toBe("wu1:code");

    var miss = await sc.decodeUploadedQr(
      { name: "a.png" },
      {
        decodeImageFile: async function () {
          return null;
        },
      },
    );
    expect(miss.hint).toBe(sc.HINT_NO_QR);

    var boom = await sc.decodeUploadedQr(
      { name: "a.png" },
      {
        decodeImageFile: async function () {
          throw new Error("decode");
        },
      },
    );
    expect(boom.hint).toBe(sc.HINT_NO_QR);

    var defaultExport = sc.createQrExport({ qrPng: qrPng });
    expect(defaultExport).toBeTruthy();
  });
})();
