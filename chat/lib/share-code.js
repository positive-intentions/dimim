BP.module("chat/lib/share-code", [], function () {
  var DEFAULT_FILENAME = "connection-code.png";
  var HINT_QR_NOT_READY = "QR isn’t ready yet. Wait a moment and try again.";
  var HINT_NO_QR = "No QR code found in that image.";

  function findQrSvg(host) {
    if (!host) return null;
    try {
      var qr = host.querySelector("dimui-qr-code");
      if (!qr || !qr.shadowRoot) return null;
      return qr.shadowRoot.querySelector("svg");
    } catch (e) {
      return null;
    }
  }

  function readLivePaste(pasteRowEl, fallback) {
    var live = fallback;
    try {
      var field = pasteRowEl && pasteRowEl.querySelector("dimui-text-field");
      var input =
        field &&
        field.shadowRoot &&
        field.shadowRoot.querySelector("input, textarea");
      if (input && String(input.value || "").length) {
        live = input.value;
      }
    } catch (e) {}
    return live;
  }

  /**
   * @param {{ qrPng: object, filename?: string }} opts
   */
  function createQrExport(opts) {
    var qrPng = opts && opts.qrPng;
    var filename = (opts && opts.filename) || DEFAULT_FILENAME;

    async function rasterize(host) {
      var svg = findQrSvg(host);
      if (!svg) {
        return { blob: null, hint: HINT_QR_NOT_READY };
      }
      try {
        var blob = await qrPng.pngBlobFromSvg(svg, 512);
        return { blob: blob, hint: "" };
      } catch (e) {
        return { blob: null, hint: HINT_QR_NOT_READY };
      }
    }

    async function save(host, qrReady, canShare) {
      if (!qrReady) {
        return { hint: HINT_QR_NOT_READY };
      }
      var result = await rasterize(host);
      if (!result.blob) {
        return { hint: result.hint };
      }
      var downloadResult = qrPng.downloadPng(result.blob, filename);
      if (downloadResult === "unsupported") {
        return {
          hint: canShare
            ? "Couldn’t save here — try Share QR Code instead."
            : "Couldn’t save the QR here. Copy the code or take a screenshot.",
        };
      }
      return { hint: "" };
    }

    async function share(host, qrReady) {
      if (!qrReady) {
        return { hint: HINT_QR_NOT_READY };
      }
      var result = await rasterize(host);
      if (!result.blob) {
        return { hint: result.hint };
      }
      var shareResult = await qrPng.sharePng(
        result.blob,
        filename,
        "Meet code",
      );
      if (shareResult === "abort") {
        return { hint: "" };
      }
      if (shareResult === "gesture") {
        return { hint: "Tap Share QR Code again to continue." };
      }
      if (shareResult === "unsupported" || shareResult === "fail") {
        return {
          hint:
            "Couldn’t share the QR here. Try Save QR Code or copy the code.",
        };
      }
      return { hint: "" };
    }

    return {
      rasterize: rasterize,
      save: save,
      share: share,
    };
  }

  async function decodeUploadedQr(file, qrDecode) {
    if (!file) {
      return { text: null, hint: "" };
    }
    var text = null;
    try {
      text = await qrDecode.decodeImageFile(file);
    } catch (e) {
      text = null;
    }
    if (text) {
      return { text: String(text), hint: "" };
    }
    return { text: null, hint: HINT_NO_QR };
  }

  return {
    findQrSvg: findQrSvg,
    readLivePaste: readLivePaste,
    createQrExport: createQrExport,
    decodeUploadedQr: decodeUploadedQr,
    HINT_QR_NOT_READY: HINT_QR_NOT_READY,
    HINT_NO_QR: HINT_NO_QR,
  };
});
