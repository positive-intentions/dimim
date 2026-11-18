BP.module(
  "chat/components/templates/meet-layout",
  [
    "chat/lib/tokens",
    "chat/components/organisms/pairing-wizard",
    "chat/components/organisms/chat-thread",
    "chat/components/organisms/call-screen",
    "chat/components/molecules/confirm-dialog",
  ],
  function (tokens, pairing, thread, callScreen, confirm) {
    const { define, css } = Dim;
    const { chatTokens } = tokens;
    const { PairingWizard } = pairing;
    const { ChatThread } = thread;
    const { CallScreen } = callScreen;
    const { ConfirmDialog } = confirm;

    const styles = css`
      ${chatTokens}

      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }

      .layout {
        height: 100%;
        min-height: 0;
        background: var(--chat-bg);
        color: var(--chat-text);
      }
    `;

    const MeetLayout = define({
      tag: "dimim-meet-layout",
      component: (props, { html: tpl, useStyle: style, useScope: scope }) => {
        style(styles);
        scope({ PairingWizard, ChatThread, CallScreen, ConfirmDialog });

        const theme = props.theme === "light" ? "light" : "dark";
        const connected = Boolean(props.connected);
        const pairingProps = props.pairingProps || {};
        const threadProps = props.threadProps || {};
        const callProps = props.callProps || {};
        const confirmProps = props.confirmProps || {};

        return tpl`
          <div class="layout frame" data-theme="${theme}">
            ${
              connected
                ? tpl`<dimim-chat-thread .props="${threadProps}" />`
                : tpl`<dimim-pairing-wizard .props="${pairingProps}" />`
            }
            <dimim-call-screen .props="${callProps}" />
            <dimim-confirm-dialog .props="${confirmProps}" />
          </div>
        `;
      },
    });

    return { MeetLayout };
  },
);
