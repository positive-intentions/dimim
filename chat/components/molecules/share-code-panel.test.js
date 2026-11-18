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

  test("share-code-panel actions", async function () {
    await BP.require("chat/components/molecules/share-code-panel");
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

    var buttons = el.shadowRoot.querySelectorAll("dimui-button");
    // Copy, Scan
    buttons[1].shadowRoot.querySelector("button").click();
    expect(scanned).toBe(true);

    // Hide paste is shown by default (showMore true) — toggle hide then show
    buttons[2].shadowRoot.querySelector("button").click();
    await flush(el);
    buttons = el.shadowRoot.querySelectorAll("dimui-button");
    var showPaste = Array.prototype.find.call(buttons, function (b) {
      return (b.shadowRoot.textContent || "").indexOf("Paste peer code") >= 0;
    });
    if (showPaste) {
      showPaste.shadowRoot.querySelector("button").click();
      await flush(el);
    }
    expect(Boolean(el.shadowRoot.querySelector("dimui-text-field"))).toBe(true);

    var field = el.shadowRoot.querySelector("dimui-text-field");
    var input = field.shadowRoot.querySelector("input");
    input.value = "wu1:peer";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush(el);
    buttons = el.shadowRoot.querySelectorAll("dimui-button");
    var usePaste = Array.prototype.find.call(buttons, function (b) {
      return (b.shadowRoot.textContent || "").indexOf("Use pasted") >= 0;
    });
    usePaste.shadowRoot.querySelector("button").click();
    expect(pasted).toBe("wu1:peer");

    buttons[0].shadowRoot.querySelector("button").click();
    await flush(el);

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
  });
})();
