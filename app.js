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
  var css = Dim.css;

  var shellStyles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: var(--dimui-doc-bg, #0f172a);
      color: var(--dimui-doc-text, #e2e8f0);
    }
    header.bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--dimui-doc-border, #334155);
      background: var(--dimui-doc-surface, #1e293b);
    }
    header.bar h1 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      flex: 1 1 auto;
    }
    header.bar .meta {
      font-size: 0.8rem;
      color: var(--dimui-doc-text-muted, #94a3b8);
    }
    header.bar button {
      appearance: none;
      border: 1px solid var(--dimui-doc-border, #334155);
      background: var(--dimui-doc-surface-2, #0b1220);
      color: var(--dimui-doc-text, #e2e8f0);
      border-radius: 6px;
      padding: 0.35rem 0.7rem;
      font: inherit;
      cursor: pointer;
    }
    header.bar button.active {
      border-color: var(--dimui-doc-primary, #029cfd);
      color: var(--dimui-doc-primary, #029cfd);
    }
    header.bar button:hover {
      background: var(--dimui-doc-surface-hover, #334155);
    }
    header.bar button.install {
      border-color: var(--dimui-doc-primary, #029cfd);
      color: var(--dimui-doc-primary, #029cfd);
    }
    .ios-tip {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin: 0;
      padding: 0.65rem 1rem;
      border-bottom: 1px solid var(--dimui-doc-border, #334155);
      background: var(--dimui-doc-surface-2, #0b1220);
      color: var(--dimui-doc-text-muted, #94a3b8);
      font-size: 0.85rem;
      line-height: 1.4;
    }
    .ios-tip strong {
      color: var(--dimui-doc-text, #e2e8f0);
      font-weight: 600;
    }
    .ios-tip button {
      appearance: none;
      margin-left: auto;
      border: none;
      background: transparent;
      color: var(--dimui-doc-text-muted, #94a3b8);
      font: inherit;
      cursor: pointer;
      padding: 0 0.25rem;
    }
    .body {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .body > * {
      flex: 1 1 auto;
      min-height: 0;
    }
    .error {
      margin: 1.5rem;
      padding: 1rem 1.25rem;
      border-radius: 8px;
      border: 1px solid var(--dimui-doc-danger, #ef4444);
      background: var(--dimui-doc-danger-bg, #7f1d1d);
      color: #fff;
      white-space: pre-wrap;
      font-family: ui-monospace, Menlo, monospace;
      font-size: 0.85rem;
    }
  `;

  function currentImpl() {
    return document.documentElement.dataset.dimRuntime || "js";
  }

  function setImpl(next) {
    var url = new URL(location.href);
    url.searchParams.set("impl", next);
    location.href = url.toString();
  }

  function dispatchTheme(theme) {
    try {
      localStorage.setItem("dimui-explorer-theme", theme);
    } catch (_) {}
    window.dispatchEvent(
      new CustomEvent("dimui-theme-change", { detail: { theme: theme } }),
    );
  }

  var bootError = null;
  var MeetApp = null;
  var themeApi = null;

  async function boot() {
    try {
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

        style(shellStyles);

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
        var impl = currentImpl();

        if (MeetApp) {
          scope({ MeetApp: MeetApp });
        }

        effect(function () {
          if (themeApi && themeApi.applyDocumentTheme) {
            themeApi.applyDocumentTheme(theme);
          }
          dispatchTheme(theme);
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
                setImpl("js");
              }}"
            >
              JS
            </button>
            <button
              type="button"
              class="${impl === "wasm" ? "active" : ""}"
              @click="${function () {
                setImpl("wasm");
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
