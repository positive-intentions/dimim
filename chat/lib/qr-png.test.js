(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("qr-png rasterize download share helpers", async function () {
    var mod = await BP.require("chat/lib/qr-png");
    expect(typeof mod.pngBlobFromSvg).toBe("function");
    expect(typeof mod.canSharePng).toBe("function");
    expect(typeof mod.downloadPng).toBe("function");
    expect(typeof mod.sharePng).toBe("function");
    expect(typeof mod.supportsDownloadAttribute).toBe("function");

    var emptyThrew = false;
    try {
      await mod.pngBlobFromSvg(null);
    } catch (e) {
      emptyThrew = !!(e && e.name === "empty");
    }
    expect(emptyThrew).toBe(true);

    emptyThrew = false;
    try {
      await mod.pngBlobFromSvg(undefined);
    } catch (e) {
      emptyThrew = !!(e && e.name === "empty");
    }
    expect(emptyThrew).toBe(true);

    emptyThrew = false;
    try {
      await mod.pngBlobFromSvg("<div>nope</div>");
    } catch (e) {
      emptyThrew = !!(e && e.name === "empty");
    }
    expect(emptyThrew).toBe(true);

    emptyThrew = false;
    try {
      await mod.pngBlobFromSvg("");
    } catch (e) {
      emptyThrew = !!(e && e.name === "empty");
    }
    expect(emptyThrew).toBe(true);

    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2" width="2" height="2">' +
      '<path fill="#000" d="M0,0h2v2h-2z"/></svg>';
    var blob = await mod.pngBlobFromSvg(svg, 64);
    expect(Boolean(blob && blob.type === "image/png")).toBe(true);
    expect(blob.size > 0).toBe(true);

    var blobDefault = await mod.pngBlobFromSvg(svg);
    expect(Boolean(blobDefault && blobDefault.type === "image/png")).toBe(true);

    var el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el.setAttribute("viewBox", "0 0 2 2");
    el.setAttribute("width", "2");
    el.setAttribute("height", "2");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "#000");
    path.setAttribute("d", "M0,0h2v2h-2z");
    el.appendChild(path);
    var blob2 = await mod.pngBlobFromSvg(el, 128);
    expect(Boolean(blob2 && blob2.type === "image/png")).toBe(true);

    expect(mod.downloadPng(null)).toBe("unsupported");
    var origSupports = mod.supportsDownloadAttribute;
    mod.supportsDownloadAttribute = function () {
      return false;
    };
    expect(mod.downloadPng(blob)).toBe("unsupported");
    mod.supportsDownloadAttribute = function () {
      return true;
    };
    var clicked = 0;
    var origCreate = document.createElement.bind(document);
    document.createElement = function (tag) {
      var node = origCreate(tag);
      if (String(tag).toLowerCase() === "a") {
        node.click = function () {
          clicked += 1;
        };
      }
      return node;
    };
    var origCreateObjectURL = URL.createObjectURL;
    var origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = function () {
      return "blob:test";
    };
    URL.revokeObjectURL = function () {};
    expect(mod.downloadPng(blob, "connection-code.png")).toBe("ok");
    expect(mod.downloadPng(blob)).toBe("ok");
    expect(clicked).toBe(2);
    document.createElement = origCreate;
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevoke;
    mod.supportsDownloadAttribute = origSupports;

    // canSharePng branches: missing canShare, true probe, throw
    var origShareFn = navigator.share;
    var origCanShareFn = navigator.canShare;
    navigator.share = async function () {};
    navigator.canShare = undefined;
    expect(mod.canSharePng()).toBe(false);
    navigator.canShare = function () {
      return true;
    };
    expect(mod.canSharePng()).toBe(true);
    var OrigFile = globalThis.File;
    globalThis.File = function () {
      throw new Error("no file");
    };
    expect(mod.canSharePng()).toBe(false);
    globalThis.File = OrigFile;
    navigator.share = origShareFn;
    navigator.canShare = origCanShareFn;

    expect(typeof mod.supportsDownloadAttribute()).toBe("boolean");
    var origUADesc =
      Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent") ||
      Object.getOwnPropertyDescriptor(navigator, "userAgent");
    try {
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        get: function () {
          return "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36";
        },
      });
      expect(mod.supportsDownloadAttribute()).toBe(false);
    } catch (e) {
      mod.supportsDownloadAttribute();
    }
    try {
      if (origUADesc) {
        Object.defineProperty(navigator, "userAgent", origUADesc);
      }
    } catch (e) {}

    // supportsDownloadAttribute catch
    var origCreate2 = document.createElement.bind(document);
    document.createElement = function () {
      throw new Error("create fail");
    };
    expect(mod.supportsDownloadAttribute()).toBe(false);
    document.createElement = origCreate2;

    // toBlob null → reject
    var origPng = mod.pngBlobFromSvg;
    var blobFail = false;
    try {
      var realCreate = document.createElement.bind(document);
      document.createElement = function (tag) {
        var node = realCreate(tag);
        if (String(tag).toLowerCase() === "canvas") {
          node.getContext = function () {
            return {
              fillStyle: "",
              fillRect: function () {},
              drawImage: function () {},
            };
          };
          node.toBlob = function (cb) {
            cb(null);
          };
        }
        return node;
      };
      await mod.pngBlobFromSvg(svg, 64);
    } catch (e) {
      blobFail = String(e && e.message ? e.message : e).indexOf("blob") >= 0;
    }
    document.createElement = origCreate2;
    expect(blobFail).toBe(true);
    void origPng;

    expect(await mod.sharePng(null)).toBe("fail");

    var origCan = mod.canSharePng;
    mod.canSharePng = function () {
      return false;
    };
    expect(await mod.sharePng(blob)).toBe("unsupported");
    mod.canSharePng = function () {
      return true;
    };

    var origShare = navigator.share;
    navigator.share = async function () {};
    expect(await mod.sharePng(blob, "t.png", "Meet code")).toBe("ok");
    expect(await mod.sharePng(blob)).toBe("ok");

    navigator.share = async function () {
      var err = new Error("nope");
      err.name = "AbortError";
      throw err;
    };
    expect(await mod.sharePng(blob)).toBe("abort");

    navigator.share = async function () {
      var err = new Error("nope");
      err.name = "NotAllowedError";
      throw err;
    };
    expect(await mod.sharePng(blob)).toBe("gesture");

    navigator.share = async function () {
      throw new Error("other");
    };
    expect(await mod.sharePng(blob)).toBe("fail");

    navigator.share = async function () {
      throw { name: undefined };
    };
    expect(await mod.sharePng(blob)).toBe("fail");

    navigator.share = origShare;
    mod.canSharePng = origCan;

    expect(typeof mod.canSharePng()).toBe("boolean");
  });
})();
