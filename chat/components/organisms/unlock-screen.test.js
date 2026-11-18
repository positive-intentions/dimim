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

  function setTextField(field, value) {
    var input =
      field.shadowRoot && field.shadowRoot.querySelector("input, textarea");
    if (!input) throw new Error("text field input missing");
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function clickHost(host) {
    var btn =
      (host.shadowRoot && host.shadowRoot.querySelector("button")) || host;
    btn.click();
  }

  async function flush(el) {
    if (el && el.updateComplete) await el.updateComplete;
    await sleep(0);
  }

  test("unlock-screen create vault validation and success", async function () {
    await BP.require("chat/components/organisms/unlock-screen");
    var vault = await BP.require("chat/lib/vault");
    try {
      localStorage.removeItem(vault.VAULT_FLAG);
    } catch (e) {}

    var unlocked = null;
    var el = await mount("dimim-unlock", {
      hasVault: false,
      theme: "light",
      onUnlock: function (password, opts) {
        unlocked = { password: password, opts: opts };
      },
    });
    expect(shadowText(el)).toContain("Choose a password");

    var button = el.shadowRoot.querySelector("dimui-button");
    clickHost(button);
    await flush(el);
    expect(shadowText(el)).toContain("Enter a password");

    var fields = el.shadowRoot.querySelectorAll("dimui-text-field");
    setTextField(fields[0], "abc");
    setTextField(fields[1], "abc");
    await flush(el);
    clickHost(button);
    await flush(el);
    expect(shadowText(el)).toContain("Use at least 4 characters");

    fields = el.shadowRoot.querySelectorAll("dimui-text-field");
    setTextField(fields[0], "abcd");
    setTextField(fields[1], "abce");
    await flush(el);
    clickHost(button);
    await flush(el);
    expect(shadowText(el)).toContain("Passwords do not match");

    fields = el.shadowRoot.querySelectorAll("dimui-text-field");
    setTextField(fields[0], "abcd");
    setTextField(fields[1], "abcd");
    await flush(el);
    clickHost(button);
    await flush(el);
    expect(unlocked && unlocked.password).toBe("abcd");
    expect(unlocked.opts.create).toBe(true);
  });

  test("unlock-screen existing vault unlock", async function () {
    await BP.require("chat/components/organisms/unlock-screen");
    var unlocked = null;
    var el = await mount("dimim-unlock", {
      hasVault: true,
      theme: "dark",
      error: "Wrong password.",
      onUnlock: function (password, opts) {
        unlocked = { password: password, opts: opts };
      },
    });
    expect(shadowText(el)).toContain("Enter your password");
    expect(shadowText(el)).toContain("Wrong password.");
    var field = el.shadowRoot.querySelector("dimui-text-field");
    setTextField(field, "secret");
    var input = field.shadowRoot.querySelector("input");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flush(el);
    // Enter may not bubble through Dim binding the same way; click Unlock.
    clickHost(el.shadowRoot.querySelector("dimui-button"));
    await flush(el);
    expect(unlocked && unlocked.password).toBe("secret");
    expect(unlocked.opts.create).toBe(false);
  });
})();
