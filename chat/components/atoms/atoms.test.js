(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

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
})();
