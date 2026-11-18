(function () {
  var e2e = DimTest.e2e || DimTest.test;
  var expect = DimTest.expect;

  e2e("e2e: two-iframe invite/reply ping-pong", async function () {
    expect(typeof DimimE2E).toBe("object");
    DimimE2E.closeAllPeers();

    var pageA = await DimimE2E.openPeer("a", { timeout: 60000 });
    var pageB = await DimimE2E.openPeer("b", { timeout: 60000 });

    try {
      await DimimE2E.createVault(pageA, "pass-a-1234");
      await DimimE2E.createVault(pageB, "pass-b-1234");

      await DimimE2E.completeProfile(pageA, "Ada", "ada");
      await DimimE2E.completeProfile(pageB, "Bo", "bo");

      var invite = await DimimE2E.readCode(pageA);
      expect(invite.indexOf("wu1:")).toBe(0);

      await DimimE2E.pasteCode(pageB, invite);
      await pageB.wait(function () {
        var text = pageB.text("dimim-pairing-wizard") || "";
        if (text.indexOf("Share your reply") >= 0) return true;
        if (text.indexOf("Accept failed") >= 0) {
          throw new Error("B accept failed: " + text.slice(0, 200));
        }
        return null;
      }, 60000);

      var reply = await DimimE2E.readCode(pageB);
      expect(reply.indexOf("wu1:")).toBe(0);

      await DimimE2E.pasteCode(pageA, reply);

      await pageA.wait(function () {
        var text = pageA.text() || "";
        if (pageA.query("dimim-chat-thread")) return true;
        if (text.indexOf("Reply failed") >= 0) {
          throw new Error("A reply failed: " + text.slice(0, 200));
        }
        return null;
      }, 60000);
      await pageB.wait("dimim-chat-thread", 60000);

      await pageA.wait(function () {
        var composer = pageA.query("dimim-composer");
        return composer && composer.shadowRoot && composer.shadowRoot.querySelector("textarea")
          ? true
          : null;
      }, 15000);

      await DimimE2E.sendChat(pageA, "ping-from-a");
      await pageB.wait(function () {
        var t = pageB.text("dimim-chat-thread") || "";
        return t.indexOf("ping-from-a") >= 0 ? true : null;
      }, 30000);

      await DimimE2E.sendChat(pageB, "pong-from-b");
      await pageA.wait(function () {
        var t = pageA.text("dimim-chat-thread") || "";
        return t.indexOf("pong-from-b") >= 0 ? true : null;
      }, 30000);

      // Optional call smoke (fake media flags in Playwright)
      var header = pageA.query("dimim-chat-header");
      if (header && header.shadowRoot) {
        var icons = header.shadowRoot.querySelectorAll("dimui-icon-button");
        if (icons.length > 1) {
          await pageA.click(icons[1]);
          await pageB.wait(function () {
            return pageB.query("dimim-incoming-call-banner") ||
              pageB.query("dimim-call-screen")
              ? true
              : null;
          }, 15000).catch(function () {
            return null;
          });
          var banner = pageB.query("dimim-incoming-call-banner");
          if (banner && banner.shadowRoot) {
            var accept = banner.shadowRoot.querySelectorAll("dimui-button")[1];
            if (accept) await pageB.click(accept);
          }
          await DimimE2E.sleep(500);
          var callA = pageA.query("dimim-call-screen");
          if (callA && callA.shadowRoot) {
            var end = Array.prototype.find.call(
              callA.shadowRoot.querySelectorAll("dimui-button"),
              function (b) {
                return (
                  ((b.shadowRoot && b.shadowRoot.textContent) || "").indexOf(
                    "End",
                  ) >= 0
                );
              },
            );
            if (end) await pageA.click(end);
          }
        }
      }
    } finally {
      DimimE2E.closeAllPeers();
    }
  });
})();
