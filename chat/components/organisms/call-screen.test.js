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

  test("call-screen controls", async function () {
    await BP.require("chat/components/organisms/call-screen");
    var ended = false;
    var toggled = false;
    var muted = null;
    var cam = null;
    var shared = false;
    function FakeStream() {
      this._tracks = [];
    }
    var local = new FakeStream();
    var remote = new FakeStream();
    var el = await mount("dimim-call-screen", {
      open: true,
      kind: "video",
      phase: "active",
      peer: { displayName: "Bo" },
      minimized: false,
      sharing: false,
      localStream: local,
      remoteStream: remote,
      onEnd: function () {
        ended = true;
      },
      onToggleMinimize: function () {
        toggled = true;
      },
      onToggleMute: function (v) {
        muted = v;
      },
      onToggleCamera: function (v) {
        cam = v;
      },
      onToggleShare: function () {
        shared = true;
      },
    });
    expect(shadowText(el)).toContain("Bo");
    expect(Boolean(el.shadowRoot.querySelector("video.remote"))).toBe(true);
    expect(Boolean(el.shadowRoot.querySelector("video.local"))).toBe(true);
    var buttons = el.shadowRoot.querySelectorAll("dimui-button");
    // Mute, Camera, Share, Minimize, End
    buttons[0].shadowRoot.querySelector("button").click();
    buttons[1].shadowRoot.querySelector("button").click();
    buttons[2].shadowRoot.querySelector("button").click();
    buttons[3].shadowRoot.querySelector("button").click();
    buttons[4].shadowRoot.querySelector("button").click();
    await sleep(0);
    expect(toggled).toBe(true);
    expect(ended).toBe(true);
    expect(muted).toBe(false);
    expect(cam).toBe(false);
    expect(shared).toBe(true);
  });
})();
