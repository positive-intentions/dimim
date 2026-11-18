(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;
  var mount = DimTest.mount;

  test("meet-layout pairing vs thread", async function () {
    await BP.require("chat/components/templates/meet-layout");
    var pairing = await mount("dimim-meet-layout", {
      theme: "dark",
      connected: false,
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
      callProps: { open: false },
      confirmProps: { open: false },
    });
    expect(pairing.shadowRoot.querySelector("dimim-pairing-wizard")).toBeTruthy();
    expect(pairing.shadowRoot.querySelector("dimim-chat-thread")).toBe(null);

    var thread = await mount("dimim-meet-layout", {
      theme: "light",
      connected: true,
      pairingProps: {},
      threadProps: {
        theme: "light",
        peer: { displayName: "Alex Rivera" },
        connected: true,
        messages: [],
      },
      callProps: { open: false },
      confirmProps: { open: false },
    });
    expect(thread.shadowRoot.querySelector("dimim-chat-thread")).toBeTruthy();
    expect(thread.shadowRoot.querySelector("dimim-pairing-wizard")).toBe(null);
  });
})();
