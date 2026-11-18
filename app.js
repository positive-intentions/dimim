/**
 * Local shell: header + runtime/theme toggles + local Meet composition.
 * Classic script — uses global Dim and BP.require for local chat modules.
 * Dimui atoms / theme load from GitHub Pages via dimui/* BP deps.
 */
(function () {
  var Dim = globalThis.Dim;
  if (!Dim) {
    document.body.textContent =
      "Dim runtime missing. Open index.html so the remote Dim IIFE can load from Pages.";
    return;
  }
  if (!globalThis.BP) {
    document.body.textContent =
      "BP registry missing. Ensure runtime.js loads before the chat scripts.";
    return;
  }

  var define = Dim.define;

  var bootError = null;
  var MeetApp = null;
  var themeApi = null;
  var chrome = null;

  async function boot() {
    try {
      chrome = await BP.require("chat/lib/app-chrome");
      if (chrome && chrome.setNavigateImpl) {
        chrome.setNavigateImpl(function (href) {
          location.href = href;
        });
      }
      themeApi = await BP.require("chat/lib/theme");
      var meet = await BP.require("chat/components/pages/meet-app");
      MeetApp = meet.MeetApp;
      if (!MeetApp) {
        throw new Error("chat/components/pages/meet-app did not export MeetApp");
      }
      var initial =
        (themeApi.getStoredTheme && themeApi.getStoredTheme()) || "dark";
      if (themeApi.applyDocumentTheme) themeApi.applyDocumentTheme(initial);
      document.documentElement.style.height = "100%";
      document.body.style.margin = "0";
      document.body.style.minHeight = "100%";
    } catch (err) {
      bootError =
        "Failed to boot the local Meet app.\n" +
        "Atoms and theme.js load from https://positive-intentions.github.io/dimui/\n" +
        "(needs network). Local chat modules use the BP registry.\n\n" +
        (err && (err.stack || err.message)
          ? err.stack || err.message
          : String(err));
      console.error(err);
    }

    define({
      tag: "dimim-app",
      component: function (_, hooks) {
        var tpl = hooks.html;
        var style = hooks.useStyle;
        var scope = hooks.useScope;
        var state = hooks.useState;
        var effect = hooks.useEffect;

        if (chrome && chrome.shellStyles) {
          style(chrome.shellStyles);
        }

        var themeState = state(
          (themeApi && themeApi.getStoredTheme && themeApi.getStoredTheme()) ||
            "dark",
        );
        var theme = themeState[0];
        var setTheme = themeState[1];
        var installState = state({
          canInstall: false,
          showIosTip: false,
          isStandalone: false,
          insecure: false,
        });
        var install = installState[0];
        var setInstall = installState[1];
        var tipDismissedState = state(false);
        var tipDismissed = tipDismissedState[0];
        var setTipDismissed = tipDismissedState[1];
        var impl =
          chrome && chrome.currentImpl ? chrome.currentImpl() : "js";

        if (MeetApp) {
          scope({ MeetApp: MeetApp });
        }

        effect(function () {
          if (themeApi && themeApi.applyDocumentTheme) {
            themeApi.applyDocumentTheme(theme);
          }
          if (chrome && chrome.dispatchTheme) {
            chrome.dispatchTheme(theme);
          }
        }, [theme]);

        effect(function () {
          if (!themeApi || !themeApi.subscribeExplorerTheme) return;
          return themeApi.subscribeExplorerTheme(function (next) {
            setTheme(next);
          });
        }, []);

        effect(function () {
          var dimPwa = globalThis.DimPwa;
          if (!dimPwa || !dimPwa.subscribe) return;
          return dimPwa.subscribe(function (snap) {
            setInstall(snap);
          });
        }, []);

        if (bootError) {
          return tpl`<div class="error" role="alert">${bootError}</div>`;
        }

        var showIosTip = install.showIosTip && !tipDismissed;
        var showInstall = install.canInstall;

        return tpl`
          <header class="bar">
            <h1>dimim — encrypted Meet</h1>
            <span class="meta">runtime: ${impl}</span>
            ${
              showInstall
                ? tpl`<button
              type="button"
              class="install"
              @click="${function () {
                var dimPwa = globalThis.DimPwa;
                if (dimPwa && dimPwa.promptInstall) dimPwa.promptInstall();
              }}"
            >
              Install
            </button>`
                : ""
            }
            <button
              type="button"
              class="${impl === "js" ? "active" : ""}"
              @click="${function () {
                if (chrome && chrome.setImpl) chrome.setImpl("js");
              }}"
            >
              JS
            </button>
            <button
              type="button"
              class="${impl === "wasm" ? "active" : ""}"
              @click="${function () {
                if (chrome && chrome.setImpl) chrome.setImpl("wasm");
              }}"
            >
              WASM
            </button>
            <button
              type="button"
              @click="${function () {
                setTheme(theme === "light" ? "dark" : "light");
              }}"
            >
              ${theme === "light" ? "Dark" : "Light"}
            </button>
          </header>
          ${
            showIosTip
              ? tpl`<div class="ios-tip" role="status">
            <span>
              <strong>Add to Home Screen:</strong>
              tap Share, then Add to Home Screen.
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              @click="${function () {
                setTipDismissed(true);
              }}"
            >
              ×
            </button>
          </div>`
              : ""
          }
          <div class="body">
            <dimim-meet-app />
          </div>
        `;
      },
    });
  }

  boot();
})();
