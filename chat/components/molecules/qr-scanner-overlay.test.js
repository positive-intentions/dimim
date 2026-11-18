(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;
  var mount = DimTest.mount;

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  async function flush(el) {
    if (el && el.updateComplete) await el.updateComplete;
    await sleep(0);
    await new Promise(function (r) {
      requestAnimationFrame(function () {
        requestAnimationFrame(r);
      });
    });
  }

  function scannerRoot(overlay) {
    var scanner = overlay.shadowRoot.querySelector("dimui-qr-scanner");
    return scanner && scanner.shadowRoot;
  }

  test("qr-scanner-overlay open close and file detect", async function () {
    await BP.require("chat/components/molecules/qr-scanner-overlay");
    var decodeMod =
      globalThis.__DIMUI_QR_DECODE__ ||
      (await BP.require("dimui/lib/qr-decode"));
    var origStart = decodeMod.startCameraScan;
    var origDecode = decodeMod.decodeImageFile;

    // Avoid real getUserMedia while the overlay is open.
    decodeMod.startCameraScan = function () {
      return { stop: function () {} };
    };
    decodeMod.decodeImageFile = async function () {
      return "wu1:from-image";
    };

    var closed = false;
    var detected = null;
    var el = await mount("dimim-qr-scanner-overlay", {
      open: true,
      onClose: function () {
        closed = true;
      },
      onDetect: function (code) {
        detected = code;
      },
    });
    await flush(el);

    var root = scannerRoot(el);
    expect(Boolean(root)).toBe(true);
    expect((root.textContent || "").indexOf("Scan peer code") >= 0).toBe(true);

    var fileInput = root.querySelector('input[type="file"]');
    expect(Boolean(fileInput)).toBe(true);
    var file = new File(["fake"], "invite.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      get: function () {
        return [file];
      },
    });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await flush(el);
    await sleep(50);

    expect(detected).toBe("wu1:from-image");
    expect(closed).toBe(true);

    closed = false;
    detected = null;
    el = await mount("dimim-qr-scanner-overlay", {
      open: true,
      onClose: function () {
        closed = true;
      },
      onPasteCode: function (code) {
        detected = code;
      },
    });
    await flush(el);
    root = scannerRoot(el);
    root
      .querySelector("dimui-icon-button")
      .shadowRoot.querySelector("button")
      .click();
    await flush(el);
    expect(closed).toBe(true);
    expect(detected).toBe(null);

    decodeMod.startCameraScan = origStart;
    decodeMod.decodeImageFile = origDecode;
  });

  test("qr-scanner-overlay camera path with fake media", async function () {
    await BP.require("chat/components/molecules/qr-scanner-overlay");
    var decodeMod =
      globalThis.__DIMUI_QR_DECODE__ ||
      (await BP.require("dimui/lib/qr-decode"));

    var origStart = decodeMod.startCameraScan;
    var stopCalls = 0;
    decodeMod.startCameraScan = function (opts) {
      setTimeout(function () {
        if (opts && typeof opts.onReady === "function") opts.onReady();
        if (opts && typeof opts.onValue === "function") {
          opts.onValue("wu1:from-camera");
        }
      }, 0);
      return {
        stop: function () {
          stopCalls += 1;
        },
      };
    };

    var detected = null;
    var closed = false;
    var el = await mount("dimim-qr-scanner-overlay", {
      open: true,
      onClose: function () {
        closed = true;
      },
      onDetect: function (code) {
        detected = code;
      },
    });
    await sleep(80);
    await flush(el);

    expect(detected).toBe("wu1:from-camera");
    expect(closed).toBe(true);
    expect(stopCalls >= 1).toBe(true);

    decodeMod.startCameraScan = origStart;

    // Default no-op handlers (coverage).
    decodeMod.startCameraScan = function () {
      return { stop: function () {} };
    };
    var bare = await mount("dimim-qr-scanner-overlay", { open: false });
    expect(Boolean(scannerRoot(bare))).toBe(true);
    decodeMod.startCameraScan = origStart;
  });
})();