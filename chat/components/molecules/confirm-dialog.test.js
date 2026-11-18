(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;
  var mount = DimTest.mount;
  var shadowText = DimTest.shadowText;

  test("confirm-dialog open and actions", async function () {
    await BP.require("chat/components/molecules/confirm-dialog");
    var confirmed = false;
    var cancelled = false;
    var el = await mount("dimui-confirm-dialog", {
      open: true,
      title: "Clear?",
      body: "Wipe messages",
      confirmLabel: "Clear",
      onConfirm: function () {
        confirmed = true;
      },
      onCancel: function () {
        cancelled = true;
      },
    });
    expect(shadowText(el)).toContain("Clear?");
    expect(shadowText(el)).toContain("Wipe messages");
    var buttons = el.shadowRoot.querySelectorAll("dimui-button");
    expect(buttons.length).toBe(2);
    var cancelBtn = buttons[0].shadowRoot.querySelector("button");
    cancelBtn.click();
    expect(cancelled).toBe(true);
    var confirmBtn = buttons[1].shadowRoot.querySelector("button");
    confirmBtn.click();
    expect(confirmed).toBe(true);
  });
})();
