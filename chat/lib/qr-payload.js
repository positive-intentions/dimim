/**
 * Fit long wu1: invite/reply bundles into a single QR via deflate+base64 (wu1z:).
 * Scanned/pasted wu1z: payloads expand back to wu1: before peer.parseBundle.
 */
BP.module("chat/lib/qr-payload", ["dimui/lib/qrcode-encoder"], function (encoder) {
  var PREFIX_Z = "wu1z:";

  function bytesToBase64(bytes) {
    var bin = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(i + chunk, bytes.length)),
      );
    }
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  var api = {
    PREFIX_Z: PREFIX_Z,

    canEncode: function (text, level) {
      try {
        encoder.encode(String(text || ""), { level: level || "M" });
        return true;
      } catch (e) {
        return false;
      }
    },

    deflateBytes: async function (bytes) {
      if (typeof globalThis.CompressionStream !== "function") {
        throw new Error("CompressionStream unavailable");
      }
      var stream = new Blob([bytes])
        .stream()
        .pipeThrough(new globalThis.CompressionStream("deflate"));
      var buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    },

    inflateBytes: async function (bytes) {
      if (typeof globalThis.DecompressionStream !== "function") {
        throw new Error("DecompressionStream unavailable");
      }
      var stream = new Blob([bytes])
        .stream()
        .pipeThrough(new globalThis.DecompressionStream("deflate"));
      var buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    },

    /**
     * @param {string} code raw invite/reply (usually wu1:…)
     * @returns {Promise<string>} value safe to put in a QR
     */
    forQr: async function (code) {
      var text = String(code || "");
      if (!text) return "";
      if (api.canEncode(text, "M") || api.canEncode(text, "L")) return text;
      var raw = new TextEncoder().encode(text);
      var deflated = await api.deflateBytes(raw);
      var packed = PREFIX_Z + bytesToBase64(deflated);
      if (!api.canEncode(packed, "L") && !api.canEncode(packed, "M")) {
        throw new Error("Invite still too long for QR after compression");
      }
      return packed;
    },

    /**
     * Expand a scanned/pasted payload.
     * @param {string} text
     * @returns {Promise<string>}
     */
    fromQr: async function (text) {
      var value = String(text || "").trim();
      if (!value) return value;
      if (value.indexOf(PREFIX_Z) !== 0) return value;
      var b64 = value.slice(PREFIX_Z.length);
      var deflated = base64ToBytes(b64);
      var raw = await api.inflateBytes(deflated);
      return new TextDecoder().decode(raw);
    },
  };

  return api;
});
