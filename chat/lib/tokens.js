BP.module("chat/lib/tokens", [], function () {
  const { css } = Dim;

  /**
   * Theme CSS variables. Apply on themed roots only —
   * a bare :host light block would wipe inherited dark mode on nested hosts.
   */
  const chatTokens = css`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
      height: 100%;
      color: var(--chat-text);
      font-family: "Segoe UI", system-ui, sans-serif;
    }

    :host([data-theme="light"]),
    .meet-app[data-theme="light"],
    .frame[data-theme="light"],
    .meet-app:not([data-theme]),
    .frame:not([data-theme]) {
      --chat-bg: #f8fafc;
      --chat-surface: #ffffff;
      --chat-surface-2: #f1f5f9;
      --chat-surface-hover: #e2e8f0;
      --chat-border: #e2e8f0;
      --chat-text: #0f172a;
      --chat-text-muted: #475569;
      --chat-text-faint: #94a3b8;
      --chat-danger: #dc2626;
      --chat-primary: #0284d4;
      --chat-primary-soft: #e0f2fe;
      --chat-bubble-out: #0284d4;
      --chat-bubble-out-text: #ffffff;
      --chat-bubble-in: #e2e8f0;
      --chat-bubble-in-text: #0f172a;
      --chat-ok: #16a34a;
    }

    :host([data-theme="dark"]),
    .meet-app[data-theme="dark"],
    .frame[data-theme="dark"] {
      --chat-bg: #0f172a;
      --chat-surface: #0b1220;
      --chat-surface-2: #1e293b;
      --chat-surface-hover: #334155;
      --chat-border: #334155;
      --chat-text: #e2e8f0;
      --chat-text-muted: #94a3b8;
      --chat-text-faint: #64748b;
      --chat-danger: #f87171;
      --chat-primary: #029cfd;
      --chat-primary-soft: #1a3a5c;
      --chat-bubble-out: #029cfd;
      --chat-bubble-out-text: #0f172a;
      --chat-bubble-in: #1e293b;
      --chat-bubble-in-text: #e2e8f0;
      --chat-ok: #4ade80;
    }

    * {
      box-sizing: border-box;
    }
  `;

  return { chatTokens };
});
