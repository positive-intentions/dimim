(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;
  var mount = DimTest.mount;

  test("meet-layout screens: pair chat profile contact", async function () {
    await BP.require("chat/components/templates/meet-layout");

    var pairing = await mount("dimim-meet-layout", {
      theme: "dark",
      activeScreen: "pair",
      pairingProps: {
        theme: "dark",
        phase: "profile",
        profile: {},
        localCode: "wu1:x",
        onProfileContinue: function () {
          return { ok: false, error: "x" };
        },
      },
      threadProps: {},
      profileProps: {},
      contactProps: {},
      callProps: { open: false },
      confirmProps: { open: false },
    });
    expect(pairing.shadowRoot.querySelector("dimim-pairing-wizard")).toBeTruthy();
    expect(pairing.shadowRoot.querySelector("dimui-chat-thread")).toBe(null);

    var thread = await mount("dimim-meet-layout", {
      theme: "light",
      activeScreen: "chat",
      pairingProps: {},
      threadProps: {
        theme: "light",
        peer: { displayName: "Alex Rivera" },
        connected: true,
        messages: [],
      },
      profileProps: {},
      contactProps: {},
      callProps: { open: false },
      confirmProps: { open: false },
    });
    expect(thread.shadowRoot.querySelector("dimui-chat-thread")).toBeTruthy();
    expect(thread.shadowRoot.querySelector("dimim-pairing-wizard")).toBe(null);

    var profile = await mount("dimim-meet-layout", {
      theme: "dark",
      activeScreen: "profile",
      pairingProps: {},
      threadProps: {},
      profileProps: {
        theme: "dark",
        profile: { displayName: "Ada", handle: "ada" },
        icePresets: [],
        onBack: function () {},
        onSave: function () {},
      },
      contactProps: {},
      callProps: { open: false },
      confirmProps: { open: false },
    });
    expect(profile.shadowRoot.querySelector("dimui-profile")).toBeTruthy();

    var contact = await mount("dimim-meet-layout", {
      theme: "dark",
      activeScreen: "contact",
      pairingProps: {},
      threadProps: {},
      profileProps: {},
      contactProps: {
        theme: "dark",
        contact: { displayName: "Alex", handle: "alex" },
        online: true,
        onBack: function () {},
      },
      callProps: { open: false },
      confirmProps: { open: false },
    });
    expect(
      contact.shadowRoot.querySelector("dimui-messaging-contact"),
    ).toBeTruthy();
  });
})();
