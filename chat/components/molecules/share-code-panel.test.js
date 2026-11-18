(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;
  var mount = DimTest.mount;
  var shadowText = DimTest.shadowText;

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

  function findButton(el, label) {
    return Array.prototype.find.call(
      el.shadowRoot.querySelectorAll("dimui-button"),
      function (b) {
        return (b.shadowRoot.textContent || "").indexOf(label) >= 0;
      },
    );
  }

  function clickButton(el, label) {
    var btn = findButton(el, label);
    expect(Boolean(btn)).toBe(true);
    btn.shadowRoot.querySelector("button").click();
    return btn;
  }

  test("share-code-panel actions", async function () {
    await BP.require("chat/components/molecules/share-code-panel");
    var qrPng = await BP.require("chat/lib/qr-png");
    var decodeMod =
      globalThis.__DIMUI_QR_DECODE__ ||
      (await BP.require("dimui/lib/qr-decode"));

    var origCanShare = qrPng.canSharePng;
    var origDownload = qrPng.downloadPng;
    var origShare = qrPng.sharePng;
    var origPngBlob = qrPng.pngBlobFromSvg;
    var origDecode = decodeMod.decodeImageFile;

    qrPng.canSharePng = function () {
      return false;
    };
    qrPng.pngBlobFromSvg = async function () {
      return new Blob(["png"], { type: "image/png" });
    };
    var downloadCalls = 0;
    qrPng.downloadPng = function () {
      downloadCalls += 1;
      return "ok";
    };

    var pasted = null;
    var scanned = false;
    var el = await mount("dimim-share-code-panel", {
      localCode: "wu1:testdemo",
      onPasteCode: function (code) {
        pasted = code;
      },
      onScan: function () {
        scanned = true;
      },
    });
    expect(shadowText(el)).toContain("wu1:testdemo");
    var codeEl = el.shadowRoot.querySelector("[data-invite-code]");
    expect(codeEl.getAttribute("data-invite-code")).toBe("wu1:testdemo");
    await flush(el);
    await sleep(40);
    var qr = el.shadowRoot.querySelector("dimui-qr-code");
    expect(Boolean(qr)).toBe(true);
    expect(Boolean(qr.shadowRoot && qr.shadowRoot.querySelector("svg"))).toBe(
      true,
    );

    expect(Boolean(findButton(el, "Save QR Code"))).toBe(true);
    expect(Boolean(findButton(el, "Upload QR Code"))).toBe(true);
    expect(findButton(el, "Share QR Code")).toBe(undefined);

    clickButton(el, "Scan their code");
    expect(scanned).toBe(true);

    clickButton(el, "Save QR Code");
    await flush(el);
    await sleep(20);
    expect(downloadCalls).toBe(1);

    // Hide paste is shown by default (showMore true) — toggle hide then show
    clickButton(el, "Hide paste");
    await flush(el);
    var showPaste = findButton(el, "Paste peer code");
    expect(Boolean(showPaste)).toBe(true);
    showPaste.shadowRoot.querySelector("button").click();
    await flush(el);
    expect(Boolean(el.shadowRoot.querySelector("dimui-text-field"))).toBe(true);

    var field = el.shadowRoot.querySelector("dimui-text-field");
    var input = field.shadowRoot.querySelector("input");
    input.value = "wu1:peer";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush(el);
    clickButton(el, "Use pasted");
    expect(pasted).toBe("wu1:peer");

    clickButton(el, "Copy code");
    await flush(el);

    decodeMod.decodeImageFile = async function () {
      return "wu1:from-upload";
    };
    pasted = null;
    var fileInput = el.shadowRoot.querySelector('input[type="file"]');
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
    await sleep(40);
    expect(pasted).toBe("wu1:from-upload");

    decodeMod.decodeImageFile = async function () {
      return null;
    };
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await flush(el);
    await sleep(40);
    expect(shadowText(el)).toContain("No QR code found");

    var minting = await mount("dimim-share-code-panel", {
      localCode: "",
      minting: true,
    });
    expect(shadowText(minting)).toContain("Minting invite");

    var payload = await BP.require("chat/lib/qr-payload");
    var origForQr = payload.forQr;
    payload.forQr = function () {
      return Promise.reject(new Error("boom"));
    };
    var failQr = await mount("dimim-share-code-panel", {
      localCode: "wu1:fail-qr",
    });
    await flush(failQr);
    await sleep(40);
    expect(shadowText(failQr)).toContain("QR unavailable");
    payload.forQr = origForQr;

    qrPng.canSharePng = origCanShare;
    qrPng.downloadPng = origDownload;
    qrPng.sharePng = origShare;
    qrPng.pngBlobFromSvg = origPngBlob;
    decodeMod.decodeImageFile = origDecode;
  });

  test("share-code-panel shows Share when canSharePng", async function () {
    await BP.require("chat/components/molecules/share-code-panel");
    var qrPng = await BP.require("chat/lib/qr-png");
    var origCanShare = qrPng.canSharePng;
    var origShare = qrPng.sharePng;
    var origPngBlob = qrPng.pngBlobFromSvg;

    qrPng.canSharePng = function () {
      return true;
    };
    qrPng.pngBlobFromSvg = async function () {
      return new Blob(["png"], { type: "image/png" });
    };
    var shareResult = "ok";
    var shareCalls = 0;
    qrPng.sharePng = async function () {
      shareCalls += 1;
      return shareResult;
    };

    var el = await mount("dimim-share-code-panel", {
      localCode: "wu1:shareable",
    });
    await flush(el);
    await sleep(40);

    expect(Boolean(findButton(el, "Share QR Code"))).toBe(true);
    clickButton(el, "Share QR Code");
    await flush(el);
    await sleep(20);
    expect(shareCalls).toBe(1);

    shareResult = "gesture";
    clickButton(el, "Share QR Code");
    await flush(el);
    await sleep(20);
    expect(shadowText(el)).toContain("Tap Share QR Code again");

    shareResult = "fail";
    clickButton(el, "Share QR Code");
    await flush(el);
    await sleep(20);
    expect(shadowText(el)).toContain("Couldn’t share the QR");

    shareResult = "abort";
    clickButton(el, "Share QR Code");
    await flush(el);
    await sleep(20);

    qrPng.pngBlobFromSvg = async function () {
      throw new Error("empty");
    };
    clickButton(el, "Share QR Code");
    await flush(el);
    await sleep(20);
    expect(shadowText(el)).toContain("QR isn’t ready yet");

    qrPng.canSharePng = origCanShare;
    qrPng.sharePng = origShare;
    qrPng.pngBlobFromSvg = origPngBlob;
  });

  test("share-code-panel save unsupported hint", async function () {
    await BP.require("chat/components/molecules/share-code-panel");
    var qrPng = await BP.require("chat/lib/qr-png");
    var decodeMod =
      globalThis.__DIMUI_QR_DECODE__ ||
      (await BP.require("dimui/lib/qr-decode"));
    var origCanShare = qrPng.canSharePng;
    var origDownload = qrPng.downloadPng;
    var origPngBlob = qrPng.pngBlobFromSvg;
    var origDecode = decodeMod.decodeImageFile;

    qrPng.canSharePng = function () {
      return true;
    };
    qrPng.pngBlobFromSvg = async function () {
      return new Blob(["png"], { type: "image/png" });
    };
    qrPng.downloadPng = function () {
      return "unsupported";
    };

    var el = await mount("dimim-share-code-panel", {
      localCode: "wu1:save-hint",
    });
    await flush(el);
    await sleep(40);
    clickButton(el, "Save QR Code");
    await flush(el);
    await sleep(20);
    expect(shadowText(el)).toContain("try Share QR Code");

    qrPng.canSharePng = function () {
      return false;
    };
    // Remount so canShare effect picks up false (effect runs once on mount).
    el = await mount("dimim-share-code-panel", {
      localCode: "wu1:save-hint2",
    });
    await flush(el);
    await sleep(40);
    clickButton(el, "Save QR Code");
    await flush(el);
    await sleep(20);
    expect(shadowText(el)).toContain("screenshot");

    qrPng.pngBlobFromSvg = async function () {
      throw new Error("empty");
    };
    clickButton(el, "Save QR Code");
    await flush(el);
    await sleep(20);
    expect(shadowText(el)).toContain("QR isn’t ready yet");

    // Upload button triggers hidden file input
    var fileInput = el.shadowRoot.querySelector('input[type="file"]');
    var clicked = false;
    fileInput.click = function () {
      clicked = true;
    };
    clickButton(el, "Upload QR Code");
    expect(clicked).toBe(true);

    // decode throws → treat as miss
    decodeMod.decodeImageFile = async function () {
      throw new Error("decode boom");
    };
    var file = new File(["fake"], "invite.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      get: function () {
        return [file];
      },
    });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await flush(el);
    await sleep(40);
    expect(shadowText(el)).toContain("No QR code found");

    // empty file list
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      get: function () {
        return [];
      },
    });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await flush(el);

    // !qrReady paths: minting / no code
    var empty = await mount("dimim-share-code-panel", {
      localCode: "",
      minting: false,
    });
    await flush(empty);
    var saveBtn = findButton(empty, "Save QR Code");
    expect(Boolean(saveBtn)).toBe(true);
    // Force-enable and click to hit !qrReady handlers
    saveBtn.shadowRoot.querySelector("button").disabled = false;
    saveBtn.shadowRoot.querySelector("button").click();
    await flush(empty);
    await sleep(20);
    expect(shadowText(empty)).toContain("QR isn’t ready yet");

    qrPng.canSharePng = function () {
      return true;
    };
    var shareEl = await mount("dimim-share-code-panel", {
      localCode: "",
    });
    await flush(shareEl);
    await sleep(20);
    var shareBtn = findButton(shareEl, "Share QR Code");
    if (shareBtn) {
      shareBtn.shadowRoot.querySelector("button").disabled = false;
      shareBtn.shadowRoot.querySelector("button").click();
      await flush(shareEl);
      await sleep(20);
      expect(shadowText(shareEl)).toContain("QR isn’t ready yet");
    }

    // findQrSvg catch: break querySelector
    qrPng.canSharePng = function () {
      return false;
    };
    qrPng.pngBlobFromSvg = origPngBlob;
    var broken = await mount("dimim-share-code-panel", {
      localCode: "wu1:broken-svg",
    });
    await flush(broken);
    await sleep(40);
    var panel = broken.shadowRoot.querySelector(".panel");
    var origQS = panel.querySelector.bind(panel);
    panel.querySelector = function () {
      throw new Error("qs fail");
    };
    clickButton(broken, "Save QR Code");
    await flush(broken);
    await sleep(20);
    expect(shadowText(broken)).toContain("QR isn’t ready yet");
    panel.querySelector = origQS;

    qrPng.canSharePng = origCanShare;
    qrPng.downloadPng = origDownload;
    qrPng.pngBlobFromSvg = origPngBlob;
    decodeMod.decodeImageFile = origDecode;
  });
})();
