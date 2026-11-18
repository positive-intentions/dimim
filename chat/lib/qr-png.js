/**
 * PNG save/share helpers for invite QR codes (SVG → PNG blob).
 * Mirrors dimui/lib/qr-png so dimim works before that module is on Pages.
 *
 * Note: avoid `else if` — DimTest coverage instrumentation rewrites
 * `else if` into a bare `else` + separate `if`, which breaks control flow.
 */
BP.module("chat/lib/qr-png", [], function () {
  var DEFAULT_SIZE = 512;
  var DEFAULT_NAME = "connection-code.png";

  function ensureXmlns(svgEl) {
    if (!svgEl) return;
    if (!svgEl.getAttribute("xmlns")) {
      svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
  }

  var api = {
    /**
     * @param {SVGElement|string} svgElOrMarkup
     * @param {number} [size]
     * @returns {Promise<Blob>}
     */
    pngBlobFromSvg: async function pngBlobFromSvg(svgElOrMarkup, size) {
      var px = Math.max(64, Number(size) || DEFAULT_SIZE);
      var markup = "";
      if (typeof svgElOrMarkup === "string") {
        markup = svgElOrMarkup;
      }
      if (!markup && svgElOrMarkup && svgElOrMarkup.nodeType === 1) {
        ensureXmlns(svgElOrMarkup);
        markup = new XMLSerializer().serializeToString(svgElOrMarkup);
      }
      if (!markup || markup.indexOf("<svg") < 0) {
        var empty = new Error("empty");
        empty.name = "empty";
        throw empty;
      }

      var svgUrl = URL.createObjectURL(
        new Blob([markup], { type: "image/svg+xml" }),
      );
      var img = new Image();
      try {
        await new Promise(function (resolve, reject) {
          img.onload = resolve;
          img.onerror = reject;
          img.src = svgUrl;
        });
      } finally {
        URL.revokeObjectURL(svgUrl);
      }

      var canvas = document.createElement("canvas");
      canvas.width = px;
      canvas.height = px;
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, px, px);
      ctx.drawImage(img, 0, 0, px, px);

      return await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) {
          if (b) {
            resolve(b);
            return;
          }
          reject(new Error("blob"));
        }, "image/png");
      });
    },

    /**
     * True when the page can open a file share sheet for a PNG.
     * @returns {boolean}
     */
    canSharePng: function canSharePng() {
      try {
        if (typeof navigator === "undefined") return false;
        if (typeof navigator.share !== "function") return false;
        if (typeof navigator.canShare !== "function") return false;
        var file = new File([new Blob([], { type: "image/png" })], "t.png", {
          type: "image/png",
        });
        return !!navigator.canShare({ files: [file] });
      } catch (e) {
        return false;
      }
    },

    /**
     * Whether `<a download>` is likely honored (desktop browsers).
     * Android Chrome often ignores blob downloads.
     * @returns {boolean}
     */
    supportsDownloadAttribute: function supportsDownloadAttribute() {
      try {
        var a = document.createElement("a");
        var hasDownload = typeof a.download === "string";
        var android = /Android/i.test(
          (typeof navigator !== "undefined" && navigator.userAgent) || "",
        );
        return hasDownload && !android;
      } catch (e) {
        return false;
      }
    },

    /**
     * @param {Blob} blob
     * @param {string} [filename]
     * @returns {"ok"|"unsupported"}
     */
    downloadPng: function downloadPng(blob, filename) {
      var name = filename || DEFAULT_NAME;
      if (!blob) return "unsupported";
      if (!api.supportsDownloadAttribute()) return "unsupported";
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      return "ok";
    },

    /**
     * @param {Blob} blob
     * @param {string} [filename]
     * @param {string} [title]
     * @returns {Promise<"ok"|"abort"|"gesture"|"fail"|"unsupported">}
     */
    sharePng: async function sharePng(blob, filename, title) {
      if (!blob) return "fail";
      if (!api.canSharePng()) return "unsupported";
      var name = filename || DEFAULT_NAME;
      var file = new File([blob], name, { type: "image/png" });
      try {
        await navigator.share({
          files: [file],
          title: title || "Meet code",
        });
        return "ok";
      } catch (e) {
        var n = e && e.name ? String(e.name) : "";
        if (n === "AbortError") return "abort";
        if (n === "NotAllowedError") return "gesture";
        return "fail";
      }
    },
  };

  try {
    globalThis.__DIMUI_QR_PNG__ = api;
  } catch (e) {}

  return api;
});
