/**
 * Dimim app chrome: shared styles + impl/theme helpers for the top-level shell.
 */
BP.module("chat/lib/app-chrome", [], function () {
  var Dim = globalThis.Dim;
  var css = Dim && Dim.css;

  var shellStyles = css
    ? css`
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
      `
    : null;

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

  return {
    shellStyles: shellStyles,
    currentImpl: currentImpl,
    setImpl: setImpl,
    dispatchTheme: dispatchTheme,
  };
});
