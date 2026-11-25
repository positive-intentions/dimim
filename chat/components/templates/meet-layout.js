BP.module(
  "chat/components/templates/meet-layout",
  [
    "chat/lib/tokens",
    "chat/components/organisms/pairing-wizard",
    "chat/components/organisms/chat-thread",
    "chat/components/organisms/profile-page",
    "chat/components/organisms/contact-page",
    "chat/components/organisms/call-screen",
    "chat/components/molecules/confirm-dialog",
  ],
  function (tokens, pairing, thread, profilePage, contactPage, callScreen, confirm) {
    const { define, css } = Dim;
    const { chatTokens } = tokens;
    const { PairingWizard } = pairing;
    const { ChatThread } = thread;
    const { Profile } = profilePage;
    const { ContactDetails } = contactPage;
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

    function resolveScreen(props) {
      var value = props.activeScreen || props.screen || "pair";
      return String(value);
    }

    const MeetLayout = define({
      tag: "dimim-meet-layout",
      component: (props, { html: tpl, useStyle: style, useScope: scope }) => {
        style(styles);
        scope({
          PairingWizard: PairingWizard,
          ChatThread: ChatThread,
          Profile: Profile,
          ContactDetails: ContactDetails,
          CallScreen: CallScreen,
          ConfirmDialog: ConfirmDialog,
        });

        const theme = props.theme === "light" ? "light" : "dark";
        const activeScreen = resolveScreen(props);
        const pairingProps = props.pairingProps || {};
        const threadProps = props.threadProps || {};
        const profileProps = props.profileProps || {};
        const contactProps = props.contactProps || {};
        const callProps = props.callProps || {};
        const confirmProps = props.confirmProps || {};

        const overlays = tpl`
          <dimim-call-screen .props="${callProps}"></dimim-call-screen>
          <dimui-confirm-dialog .props="${confirmProps}"></dimui-confirm-dialog>
        `;

        if (activeScreen === "profile") {
          return tpl`
            <div class="layout frame" data-theme="${theme}" data-screen="profile">
              <dimui-profile .props="${profileProps}"></dimui-profile>
              ${overlays}
            </div>
          `;
        }
        if (activeScreen === "contact") {
          return tpl`
            <div class="layout frame" data-theme="${theme}" data-screen="contact">
              <dimui-messaging-contact .props="${contactProps}"></dimui-messaging-contact>
              ${overlays}
            </div>
          `;
        }
        if (activeScreen === "chat") {
          return tpl`
            <div class="layout frame" data-theme="${theme}" data-screen="chat">
              <dimui-chat-thread .props="${threadProps}"></dimui-chat-thread>
              ${overlays}
            </div>
          `;
        }
        return tpl`
          <div class="layout frame" data-theme="${theme}" data-screen="pair">
            <dimim-pairing-wizard .props="${pairingProps}"></dimim-pairing-wizard>
            ${overlays}
          </div>
        `;
      },
    });

    return { MeetLayout };
  },
);
