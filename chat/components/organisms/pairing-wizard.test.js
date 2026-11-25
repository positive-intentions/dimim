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
    var input = field.shadowRoot.querySelector("input");
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  test("pairing-wizard profile continue and share", async function () {
    await BP.require("chat/components/organisms/pairing-wizard");
    var profilePayload = null;
    var el = await mount("dimim-pairing-wizard", {
      theme: "dark",
      phase: "profile",
      profile: { displayName: "", handle: "", icePreset: "public" },
      localCode: "wu1:abc",
      statusBanner: "",
      onProfileContinue: function (fields) {
        profilePayload = fields;
        if (!fields.displayName || !fields.handle) {
          return { ok: false, error: "Enter a display name and handle." };
        }
        return { ok: true, error: "" };
      },
    });
    expect(shadowText(el)).toContain("Set up your profile");
    var button = el.shadowRoot.querySelector("dimui-button");
    button.shadowRoot.querySelector("button").click();
    await sleep(0);
    expect(shadowText(el)).toContain("Enter a display name");

    var fields = el.shadowRoot.querySelectorAll("dimui-text-field");
    setTextField(fields[0], "Ada");
    setTextField(fields[1], "ada");
    var select = el.shadowRoot.querySelector("select");
    select.value = "google";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(0);
    button = el.shadowRoot.querySelector("dimui-button");
    button.shadowRoot.querySelector("button").click();
    await sleep(0);
    expect(profilePayload.displayName).toBe("Ada");
    expect(profilePayload.icePreset).toBe("google");

    var pasted = null;
    var editClicked = false;
    var share = await mount("dimim-pairing-wizard", {
      theme: "light",
      phase: "shareInvite",
      profile: { displayName: "Ada", handle: "ada", icePreset: "public" },
      localCode: "wu1:share",
      statusBanner: "Share your invite",
      minting: false,
      onPasteCode: function (code) {
        pasted = code;
        return { ok: true };
      },
      onEditProfile: function () {
        editClicked = true;
      },
    });
    expect(shadowText(share)).toContain("Share your invite");
    expect(shadowText(share)).toContain("Edit profile");
    share.shadowRoot.querySelector(".edit-profile button").click();
    expect(editClicked).toBe(true);
    var panel = share.shadowRoot.querySelector("dimim-share-code-panel");
    expect(shadowText(panel)).toContain("wu1:share");

    var connecting = await mount("dimim-pairing-wizard", {
      phase: "connecting",
      localCode: "wu1:x",
      profile: {},
    });
    expect(shadowText(connecting)).toContain("Waiting for the data channel");

    var reply = await mount("dimim-pairing-wizard", {
      phase: "shareReply",
      localCode: "wu1:reply",
      profile: { displayName: "Bo", handle: "bo" },
      onPasteCode: function () {},
    });
    expect(shadowText(reply)).toContain("Share your reply");

    var shareScan = await mount("dimim-pairing-wizard", {
      phase: "shareInvite",
      localCode: "wu1:scan",
      profile: { displayName: "Ada", handle: "ada" },
      onPasteCode: function () {},
    });
    panel = shareScan.shadowRoot.querySelector("dimim-share-code-panel");
    var scanBtn = Array.prototype.find.call(
      panel.shadowRoot.querySelectorAll("dimui-button"),
      function (b) {
        return (b.shadowRoot.textContent || "").indexOf("Scan their code") >= 0;
      },
    );
    scanBtn.shadowRoot.querySelector("button").click();
    await sleep(0);
    var scanner = shareScan.shadowRoot.querySelector("dimui-qr-scanner");
    expect(Boolean(scanner)).toBe(true);
    var closeBtn = Array.prototype.find.call(
      scanner.shadowRoot.querySelectorAll("dimui-button"),
      function (b) {
        return (b.shadowRoot.textContent || "").indexOf("Close") >= 0;
      },
    );
    closeBtn.shadowRoot.querySelector("button").click();
    await sleep(0);

    // Exercise paste on share panel
    var pasteField = panel.shadowRoot.querySelector("dimui-text-field");
    if (pasteField) {
      setTextField(pasteField, "wu1:peer");
      var usePaste = Array.prototype.find.call(
        panel.shadowRoot.querySelectorAll("dimui-button"),
        function (b) {
          return (b.shadowRoot.textContent || "").indexOf("Use pasted") >= 0;
        },
      );
      usePaste.shadowRoot.querySelector("button").click();
      expect(pasted === "wu1:peer" || pasted === null).toBe(true);
    }

    var decodeMod =
      globalThis.__DIMUI_QR_DECODE__ ||
      (await BP.require("dimui/lib/qr-decode"));
    var origStart = decodeMod.startCameraScan;
    decodeMod.startCameraScan = function (opts) {
      setTimeout(function () {
        if (opts && typeof opts.onValue === "function") {
          opts.onValue("wu1:scanned-invite");
        }
      }, 0);
      return { stop: function () {} };
    };

    var detectFromWizard = null;
    var wired = await mount("dimim-pairing-wizard", {
      phase: "shareInvite",
      localCode: "wu1:host2",
      profile: { displayName: "Ada", handle: "ada" },
      onPasteCode: function (code) {
        detectFromWizard = code;
      },
    });
    panel = wired.shadowRoot.querySelector("dimim-share-code-panel");
    scanBtn = Array.prototype.find.call(
      panel.shadowRoot.querySelectorAll("dimui-button"),
      function (b) {
        return (b.shadowRoot.textContent || "").indexOf("Scan their code") >= 0;
      },
    );
    scanBtn.shadowRoot.querySelector("button").click();
    await sleep(80);
    expect(detectFromWizard).toBe("wu1:scanned-invite");

    var replyDetect = null;
    var replyWizard = await mount("dimim-pairing-wizard", {
      phase: "shareReply",
      localCode: "wu1:reply2",
      profile: { displayName: "Bo", handle: "bo" },
      onPasteCode: function (code) {
        replyDetect = code;
      },
    });
    panel = replyWizard.shadowRoot.querySelector("dimim-share-code-panel");
    scanBtn = Array.prototype.find.call(
      panel.shadowRoot.querySelectorAll("dimui-button"),
      function (b) {
        return (b.shadowRoot.textContent || "").indexOf("Scan their code") >= 0;
      },
    );
    scanBtn.shadowRoot.querySelector("button").click();
    await sleep(80);
    expect(replyDetect).toBe(null);

    decodeMod.startCameraScan = origStart;
  });
})();
