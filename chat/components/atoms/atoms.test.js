(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

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

  test("atom proxies re-export dimui components", async function () {
    var button = await BP.require("chat/components/atoms/button");
    var icon = await BP.require("chat/components/atoms/icon");
    var iconButton = await BP.require("chat/components/atoms/icon-button");
    var chip = await BP.require("chat/components/atoms/chip");
    var textField = await BP.require("chat/components/atoms/text-field");
    var textArea = await BP.require("chat/components/atoms/text-area");
    var avatar = await BP.require("chat/components/atoms/avatar");
    var badge = await BP.require("chat/components/atoms/badge");
    var overlay = await BP.require("chat/components/atoms/overlay");
    var empty = await BP.require("chat/components/atoms/empty-state");
    var divider = await BP.require("chat/components/atoms/divider");
    var qrCode = await BP.require("chat/components/atoms/qr-code");
    var qrScanner = await BP.require("chat/components/molecules/qr-scanner");

    expect(Boolean(button.Button)).toBe(true);
    expect(Boolean(icon.Icon)).toBe(true);
    expect(Boolean(iconButton.IconButton)).toBe(true);
    expect(Boolean(chip.Chip)).toBe(true);
    expect(Boolean(textField.TextField)).toBe(true);
    expect(Boolean(textArea.TextArea)).toBe(true);
    expect(Boolean(avatar.Avatar)).toBe(true);
    expect(Boolean(badge.Badge)).toBe(true);
    expect(Boolean(overlay.Overlay)).toBe(true);
    expect(Boolean(empty.EmptyState)).toBe(true);
    expect(Boolean(divider.Divider)).toBe(true);
    expect(Boolean(qrCode.QrCode)).toBe(true);
    expect(Boolean(qrScanner.QrScanner)).toBe(true);

    var qrEl = await DimTest.mount("dimui-qr-code", {
      value: "wu1:proxy",
      size: 96,
    });
    expect(Boolean(qrEl.shadowRoot.querySelector("svg"))).toBe(true);
  });

  test("qr-code tap enlarges then Escape closes", async function () {
    await BP.require("chat/components/atoms/qr-code");
    var qrEl = await DimTest.mount("dimui-qr-code", {
      value: "wu1:enlarge-me",
      size: 96,
    });
    await flush(qrEl);

    var trigger = qrEl.shadowRoot.querySelector("button.trigger");
    // Enlarge ships in dimui; skip until Pages (or ?dimuiSrc) has the update.
    if (!trigger) {
      expect(Boolean(qrEl.shadowRoot.querySelector("svg"))).toBe(true);
      return;
    }
    expect(qrEl.shadowRoot.querySelector('[role="dialog"]')).toBe(null);

    trigger.click();
    await flush(qrEl);
    var dialog = qrEl.shadowRoot.querySelector('[role="dialog"]');
    expect(Boolean(dialog)).toBe(true);
    expect(dialog.getAttribute("aria-label")).toBe("QR code fullscreen");

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flush(qrEl);
    expect(qrEl.shadowRoot.querySelector('[role="dialog"]')).toBe(null);

    trigger.click();
    await flush(qrEl);
    dialog = qrEl.shadowRoot.querySelector('[role="dialog"]');
    expect(Boolean(dialog)).toBe(true);
    dialog.click();
    await flush(qrEl);
    expect(qrEl.shadowRoot.querySelector('[role="dialog"]')).toBe(null);
  });

  test("qr-code empty value is not enlargeable", async function () {
    await BP.require("chat/components/atoms/qr-code");
    var empty = await DimTest.mount("dimui-qr-code", {
      value: "",
      size: 96,
    });
    await flush(empty);
    expect(empty.shadowRoot.querySelector("button.trigger")).toBe(null);
    expect((empty.shadowRoot.textContent || "").indexOf("No value") >= 0).toBe(
      true,
    );
  });
})();
