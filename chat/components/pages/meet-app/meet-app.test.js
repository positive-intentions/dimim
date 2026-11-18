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

  async function flush(el) {
    if (el && el.updateComplete) await el.updateComplete;
    await sleep(0);
    await new Promise(function (r) {
      requestAnimationFrame(function () {
        requestAnimationFrame(r);
      });
    });
  }

  async function waitFor(predicate, label, timeout) {
    var start = Date.now();
    while (Date.now() - start < (timeout || 20000)) {
      var value = predicate();
      if (value) return value;
      await sleep(50);
    }
    throw new Error("waitFor timeout: " + (label || "condition"));
  }

  function installRtc() {
    function MockIceCandidate() {
      this.candidate = "candidate:1 1 UDP 2113667326 127.0.0.1 9 typ host";
      this.sdpMid = "0";
      this.sdpMLineIndex = 0;
    }
    function MockDataChannel() {
      this.readyState = "connecting";
      this.onopen = null;
      this.onclose = null;
      this.onmessage = null;
    }
    MockDataChannel.prototype.send = function () {};
    MockDataChannel.prototype.close = function () {
      this.readyState = "closed";
    };
    function MockRTCPeerConnection() {
      this.localDescription = null;
      this.remoteDescription = null;
      this.iceGatheringState = "new";
      this.signalingState = "stable";
      this.onicecandidate = null;
      this.onicegatheringstatechange = null;
      this.ondatachannel = null;
      this.ontrack = null;
      this._dc = new MockDataChannel();
      this._senders = [];
    }
    MockRTCPeerConnection.prototype.createDataChannel = function () {
      return this._dc;
    };
    MockRTCPeerConnection.prototype.getSenders = function () {
      return this._senders;
    };
    MockRTCPeerConnection.prototype.createOffer = function () {
      return Promise.resolve({
        type: "offer",
        sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n",
      });
    };
    MockRTCPeerConnection.prototype.createAnswer = function () {
      return Promise.resolve({
        type: "answer",
        sdp: "v=0\r\no=- 2 1 IN IP4 127.0.0.1\r\n",
      });
    };
    MockRTCPeerConnection.prototype.setLocalDescription = function (desc) {
      this.localDescription = desc;
      if (this.onicecandidate) {
        this.onicecandidate({ candidate: new MockIceCandidate() });
      }
      this.iceGatheringState = "complete";
      if (this.onicegatheringstatechange) this.onicegatheringstatechange();
      return Promise.resolve();
    };
    MockRTCPeerConnection.prototype.setRemoteDescription = function (desc) {
      this.remoteDescription = desc;
      return Promise.resolve();
    };
    MockRTCPeerConnection.prototype.addIceCandidate = function () {
      return Promise.resolve();
    };
    MockRTCPeerConnection.prototype.close = function () {};
    globalThis.RTCPeerConnection = MockRTCPeerConnection;
  }

  test("meet-app shows unlock then shell on create", async function () {
    installRtc();
    await BP.require("chat/components/pages/meet-app");
    var peer = await BP.require("chat/lib/peer");
    peer.setIceWaitMs(10);
    peer.reset();
    var vault = await BP.require("chat/lib/vault");
    try {
      localStorage.removeItem(vault.VAULT_FLAG);
    } catch (e) {}

    var el = await mount("dimim-meet-app", {});
    var unlock = el.shadowRoot.querySelector("dimui-unlock");
    expect(Boolean(unlock)).toBe(true);

    var fields = unlock.shadowRoot.querySelectorAll("dimui-text-field");
    setTextField(fields[0], "pass1234");
    setTextField(fields[1], "pass1234");
    await flush(unlock);
    unlock.shadowRoot
      .querySelector("dimui-button")
      .shadowRoot.querySelector("button")
      .click();

    var shell = await waitFor(function () {
      return el.shadowRoot.querySelector("dimim-chat-shell");
    }, "chat shell", 15000);
    expect(Boolean(shell)).toBe(true);

    await waitFor(function () {
      var text = shadowText(shell);
      return text.indexOf("Decrypting") < 0 &&
        text.indexOf("Opening vault") < 0 &&
        shell.shadowRoot.querySelector("dimim-meet-layout")
        ? true
        : null;
    }, "shell ready");

    var layout = shell.shadowRoot.querySelector("dimim-meet-layout");
    var wizard = layout.shadowRoot.querySelector("dimim-pairing-wizard");
    if (wizard && shadowText(wizard).indexOf("Set up your profile") >= 0) {
      var fields2 = wizard.shadowRoot.querySelectorAll("dimui-text-field");
      setTextField(fields2[0], "Ada");
      setTextField(fields2[1], "ada");
      await flush(wizard);
      wizard.shadowRoot
        .querySelector("dimui-button")
        .shadowRoot.querySelector("button")
        .click();
      await waitFor(function () {
        layout = shell.shadowRoot.querySelector("dimim-meet-layout");
        wizard =
          layout &&
          layout.shadowRoot &&
          layout.shadowRoot.querySelector("dimim-pairing-wizard");
        return wizard && shadowText(wizard).indexOf("Share your invite") >= 0
          ? true
          : null;
      }, "share");
    }

    expect(Boolean(el.shadowRoot.querySelector("dimim-chat-shell"))).toBe(true);
  });

  test("meet-app wrong password returns to unlock with error", async function () {
    await BP.require("chat/components/pages/meet-app");
    var vault = await BP.require("chat/lib/vault");
    try {
      localStorage.setItem(vault.VAULT_FLAG, "1");
    } catch (e) {}

    var el = await mount("dimim-meet-app", {});
    var unlock = el.shadowRoot.querySelector("dimui-unlock");
    expect(Boolean(unlock)).toBe(true);
    var field = unlock.shadowRoot.querySelector("dimui-text-field");
    setTextField(field, "totally-wrong");
    await flush(unlock);
    unlock.shadowRoot
      .querySelector("dimui-button")
      .shadowRoot.querySelector("button")
      .click();

    await waitFor(function () {
      unlock = el.shadowRoot.querySelector("dimui-unlock");
      return unlock && shadowText(unlock).indexOf("Wrong") >= 0 ? true : null;
    }, "wrong password error", 15000);
  });
})();
