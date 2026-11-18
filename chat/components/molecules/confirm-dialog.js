BP.module(
  "chat/components/molecules/confirm-dialog",
  ["chat/components/atoms/button"],
  function (button) {
    const { define, css } = Dim;
    const { Button } = button;

    const styles = css`
      :host {
        display: contents;
      }

      .confirm-dialog {
        position: fixed;
        inset: 0;
        z-index: 1100;
        display: grid;
        place-items: center;
        padding: 1rem;
      }

      .confirm-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(2, 6, 23, 0.55);
      }

      .confirm-panel {
        position: relative;
        width: min(360px, 100%);
        background: var(--chat-surface, #0b1220);
        border: 1px solid var(--chat-border, #334155);
        border-radius: 12px;
        padding: 1.25rem;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
        color: var(--chat-text, #e2e8f0);
      }

      .confirm-panel h3 {
        margin: 0 0 0.5rem;
        font-size: 1.0625rem;
      }

      .confirm-panel p {
        margin: 0 0 1.25rem;
        color: var(--chat-text-muted, #94a3b8);
        font-size: 0.9rem;
        line-height: 1.45;
      }

      .confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `;

    const ConfirmDialog = define({
      tag: "dimim-confirm-dialog",
      component: (props, { html: tpl, useStyle: style, useScope: scope }) => {
        style(styles);
        scope({ Button });

        const open = Boolean(props.open);
        const title = props.title || "Confirm";
        const body = props.body || "";
        const confirmLabel = props.confirmLabel || "Confirm";
        const confirmVariant = props.confirmVariant || "danger";
        const onConfirm =
          typeof props.onConfirm === "function" ? props.onConfirm : () => {};
        const onCancel =
          typeof props.onCancel === "function" ? props.onCancel : () => {};

        if (!open) return tpl``;

        return tpl`
          <div class="confirm-dialog">
            <div class="confirm-backdrop" @click="${onCancel}"></div>
            <div class="confirm-panel" role="dialog" aria-modal="true">
              <h3>${title}</h3>
              <p>${body}</p>
              <div class="confirm-actions">
                <dimui-button
                  .props="${{
                    label: "Cancel",
                    variant: "outlined",
                    size: "sm",
                    onClick: onCancel,
                  }}"
                />
                <dimui-button
                  .props="${{
                    label: confirmLabel,
                    variant: confirmVariant,
                    size: "sm",
                    onClick: onConfirm,
                  }}"
                />
              </div>
            </div>
          </div>
        `;
      },
    });

    return { ConfirmDialog };
  },
);
