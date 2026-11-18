/**
 * Two-iframe e2e helpers. Peers use DimTest.open so they share the live
 * side-by-side preview and the same srcdoc isolation as meet-app e2e.
 */
(function (global) {
  var openPeers = [];

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function seedWithImpl(seed) {
    seed = seed || {};
    try {
      var impl =
        (document.documentElement &&
          document.documentElement.dataset &&
          document.documentElement.dataset.dimRuntime) ||
        "";
      if (impl === "js" || impl === "wasm") {
        if (seed["dimim-impl"] == null) seed["dimim-impl"] = impl;
      }
    } catch (e) {}
    return seed;
  }

  function openPeer(label, opts) {
    opts = opts || {};
    if (typeof DimTest === "undefined" || typeof DimTest.open !== "function") {
      return Promise.reject(new Error("DimimE2E.openPeer: DimTest.open missing"));
    }
    var openOpts = {
      ready: opts.ready || "dimim-unlock",
      timeout: opts.timeout || 60000,
      seed: seedWithImpl(opts.seed),
    };
    if (opts.cover != null) openOpts.cover = opts.cover;
    if (opts.visible != null) openOpts.visible = opts.visible;
    if (opts.mode) openOpts.mode = opts.mode;

    return DimTest.open(opts.url || "./index.html", openOpts)
      .then(function (page) {
        openPeers.push(page);
        try {
          var w = page.window;
          if (w && w.BP && w.BP.require) {
            return w.BP.require("chat/lib/peer").then(function (peer) {
              if (peer && peer.setIceWaitMs) peer.setIceWaitMs(1500);
              if (peer && peer.setIcePreset) peer.setIcePreset("cloudflare");
              return page;
            });
          }
        } catch (e) {}
        return page;
      })
      .catch(function (err) {
        var hint = "";
        try {
          var frame = document.getElementById("dim-test-e2e-preview-frame");
          var iframes = frame && frame.querySelectorAll("iframe");
          var iframe = iframes && iframes[iframes.length - 1];
          var doc =
            iframe &&
            (iframe.contentDocument ||
              (iframe.contentWindow && iframe.contentWindow.document));
          if (doc && doc.body) {
            hint = String(doc.body.textContent || "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 180);
          }
        } catch (e2) {}
        var msg = err && err.message ? err.message : String(err);
        if (hint) {
          throw new Error(
            msg + " (peer " + (label || "?") + " body: " + hint + ")",
          );
        }
        throw err;
      });
  }

  function closeAllPeers() {
    while (openPeers.length) {
      var page = openPeers.pop();
      try {
        if (page && typeof page.close === "function") page.close();
      } catch (e) {}
    }
  }

  function readCode(page) {
    return page.wait(function () {
      var el = page.query("[data-invite-code]");
      if (!el) return null;
      var code = el.getAttribute("data-invite-code") || "";
      return code && code.indexOf("wu1:") === 0 ? code : null;
    }, 60000);
  }

  function pasteCode(page, code) {
    return page
      .wait("dimim-share-code-panel", 30000)
      .then(function () {
        var panel = page.query("dimim-share-code-panel");
        var field = panel.shadowRoot.querySelector("dimui-text-field");
        if (!field) {
          var toggle = Array.prototype.find.call(
            panel.shadowRoot.querySelectorAll("dimui-button"),
            function (b) {
              var t = (b.shadowRoot && b.shadowRoot.textContent) || "";
              return (
                t.indexOf("Paste peer code") >= 0 ||
                t.indexOf("Hide paste") >= 0
              );
            },
          );
          if (
            toggle &&
            (toggle.shadowRoot.textContent || "").indexOf("Paste") >= 0
          ) {
            return page.click(toggle).then(function () {
              return page.wait(function () {
                return panel.shadowRoot.querySelector("dimui-text-field");
              }, 5000);
            });
          }
        }
        return field;
      })
      .then(function () {
        var panel = page.query("dimim-share-code-panel");
        var field = panel.shadowRoot.querySelector("dimui-text-field");
        if (!field) throw new Error("pasteCode: paste field missing");
        return page
          .fill(field, code)
          .then(function () {
            return sleep(50);
          })
          .then(function () {
            // Ensure controlled value stuck (some Dim renders reset before click)
            var input =
              field.shadowRoot &&
              field.shadowRoot.querySelector("input, textarea");
            if (input && input.value !== code) {
              input.value = code;
              input.dispatchEvent(new Event("input", { bubbles: true }));
            }
            var usePaste = Array.prototype.find.call(
              panel.shadowRoot.querySelectorAll("dimui-button"),
              function (b) {
                return (
                  ((b.shadowRoot && b.shadowRoot.textContent) || "").indexOf(
                    "Use pasted",
                  ) >= 0
                );
              },
            );
            if (!usePaste) throw new Error("pasteCode: Use pasted missing");
            return page.click(usePaste);
          });
      });
  }

  function createVault(page, password) {
    return page.wait("dimim-unlock", 30000).then(function () {
      var fields = page.queryAll("dimui-text-field");
      return page
        .fill(fields[0], password)
        .then(function () {
          if (fields[1]) return page.fill(fields[1], password);
        })
        .then(function () {
          return page.click("dimui-button");
        })
        .then(function () {
          return page.wait("dimim-chat-shell", 30000);
        });
    });
  }

  function completeProfile(page, displayName, handle) {
    return page.wait("dimim-pairing-wizard", 30000).then(function () {
      return page
        .wait(function () {
          var text = page.text("dimim-pairing-wizard") || "";
          return text.indexOf("Set up your profile") >= 0 ? true : null;
        }, 15000)
        .then(function () {
          var fields = page.queryAll("dimui-text-field");
          return page.fill(fields[0], displayName).then(function () {
            return page.fill(fields[1], handle);
          });
        })
        .then(function () {
          var wizard = page.query("dimim-pairing-wizard");
          var btn = wizard.shadowRoot.querySelector("dimui-button");
          return page.click(btn);
        })
        .then(function () {
          return page.wait(function () {
            var text = page.text("dimim-pairing-wizard") || "";
            return text.indexOf("Share your invite") >= 0 ||
              text.indexOf("Share your reply") >= 0
              ? true
              : null;
          }, 30000);
        });
    });
  }

  function sendChat(page, body) {
    return page.wait("dimim-composer", 30000).then(function () {
      var composer = page.query("dimim-composer");
      var ta = composer.shadowRoot.querySelector("textarea");
      ta.value = body;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      var send = composer.shadowRoot.querySelectorAll("dimui-icon-button")[1];
      return page.click(send);
    });
  }

  global.DimimE2E = {
    openPeer: openPeer,
    closeAllPeers: closeAllPeers,
    readCode: readCode,
    pasteCode: pasteCode,
    createVault: createVault,
    completeProfile: completeProfile,
    sendChat: sendChat,
    sleep: sleep,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
