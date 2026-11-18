BP.module(
  "chat/components/pages/meet-app",
  [
    "chat/lib/theme",
    "chat/lib/tokens",
    "chat/components/organisms/unlock-screen",
    "chat/components/organisms/chat-shell",
  ],
  function (theme, tokens, unlock, shell) {
    const { define, css } = Dim;
    const { chatTokens } = tokens;
    const { UnlockScreen } = unlock;
    const { ChatShell } = shell;
    const { getStoredTheme, subscribeExplorerTheme } = theme;

    const styles = css`
      ${chatTokens}

      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }
    `;

    const MeetApp = define({
      tag: "dimim-meet-app",
      component: (
        _,
        {
          html: tpl,
          useState: state,
          useEffect: effect,
          useRef: ref,
          useScope: scope,
          useStyle: style,
        },
      ) => {
        style(styles);
        scope({ UnlockScreen, ChatShell });

        const [password, setPassword] = state(null);
        const [creating, setCreating] = state(false);
        const [error, setError] = state("");
        const [themeValue, setTheme] = state(getStoredTheme());
        const hostRef = ref();

        effect(() => subscribeExplorerTheme(setTheme), []);

        effect(() => {
          const host = hostRef.current;
          if (host?.setAttribute) host.setAttribute("data-theme", themeValue);
        }, [themeValue]);

        const unlockVault = (value, { create }) => {
          setError("");
          setCreating(Boolean(create));
          setPassword(value);
        };

        const leaveVault = (message) => {
          setPassword(null);
          setCreating(false);
          setError(message || "");
        };

        if (!password) {
          return tpl`
            <dimui-unlock
              .props="${{
                title: "Meet",
                unlockHint:
                  "Enter your password to decrypt this browser vault.",
                createHint:
                  "Choose a password to encrypt Meet data in this browser. There is no recovery if you forget it.",
                vaultFlag: "dimim-vault",
                onUnlock: unlockVault,
                error,
                theme: themeValue,
              }}"
            />
          `;
        }

        return tpl`
          <dimim-chat-shell
            .props="${{
              password,
              create: creating,
              onLock: leaveVault,
              onUnlockFailed: (message) =>
                leaveVault(message || "Wrong password."),
              theme: themeValue,
            }}"
          />
        `;
      },
    });
    return { MeetApp };
  },
);
