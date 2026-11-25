BP.module(
  "chat/components/organisms/pairing-wizard",
  [
    "chat/lib/tokens",
    "chat/lib/mockData",
    "chat/components/atoms/button",
    "chat/components/atoms/text-field",
    "chat/components/molecules/share-code-panel",
    "chat/components/molecules/qr-scanner",
  ],
  function (tokens, mock, button, textField, sharePanel, scanner) {
    const { define, css } = Dim;
    const { chatTokens } = tokens;
    const { ICE_PRESETS } = mock;
    const { Button } = button;
    const { TextField } = textField;
    const { ShareCodePanel } = sharePanel;
    const { QrScanner } = scanner;

    const styles = css`
      ${chatTokens}

      :host {
        display: block;
        height: 100%;
      }

      .wizard {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--chat-bg);
        color: var(--chat-text);
        padding: 1.25rem;
        overflow: auto;
      }

      .card {
        width: min(440px, 100%);
        margin: auto;
        background: var(--chat-surface);
        border: 1px solid var(--chat-border);
        border-radius: 16px;
        padding: 1.25rem;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
      }

      h1 {
        margin: 0 0 0.35rem;
        font-size: 1.4rem;
      }

      .lead {
        margin: 0 0 1.1rem;
        color: var(--chat-text-muted);
        line-height: 1.45;
      }

      .field {
        margin-bottom: 0.9rem;
      }

      .label {
        display: block;
        font-size: 0.8rem;
        color: var(--chat-text-muted);
        margin-bottom: 0.35rem;
      }

      select {
        width: 100%;
        min-height: 40px;
        border-radius: 10px;
        border: 1px solid var(--chat-border);
        background: var(--chat-surface-2);
        color: var(--chat-text);
        font: inherit;
        padding: 0.45rem 0.65rem;
      }

      .banner {
        margin-bottom: 0.85rem;
        padding: 0.55rem 0.7rem;
        border-radius: 10px;
        background: var(--chat-primary-soft);
        color: var(--chat-text);
        font-size: 0.85rem;
      }

      .connecting {
        text-align: center;
        padding: 1.5rem 0.5rem;
        color: var(--chat-text-muted);
      }

      .edit-profile {
        margin-top: 1rem;
        text-align: center;
      }

      .edit-profile button {
        border: none;
        background: transparent;
        color: var(--chat-primary);
        font: inherit;
        font-size: 0.875rem;
        cursor: pointer;
        text-decoration: underline;
        padding: 0.25rem;
      }
    `;

    const PairingWizard = define({
      tag: "dimim-pairing-wizard",
      component: (
        props,
        { html: tpl, useState: state, useStyle: style, useScope: scope },
      ) => {
        style(styles);
        scope({ Button, TextField, ShareCodePanel, QrScanner });

        const theme = props.theme === "light" ? "light" : "dark";
        const phase = props.phase || "profile";
        const profile = props.profile || {};
        const localCode = props.localCode || "";
        const statusBanner = props.statusBanner || "";
        const minting = Boolean(props.minting);
        const [scannerOpen, setScannerOpen] = state(false);
        const [displayName, setDisplayName] = state(profile.displayName || "");
        const [handle, setHandle] = state(profile.handle || "");
        const [icePreset, setIcePreset] = state(profile.icePreset || "public");
        const [error, setError] = state("");

        const onProfileContinue =
          typeof props.onProfileContinue === "function"
            ? props.onProfileContinue
            : () => {};
        const onPasteCode =
          typeof props.onPasteCode === "function"
            ? props.onPasteCode
            : () => {};
        const onEditProfile =
          typeof props.onEditProfile === "function"
            ? props.onEditProfile
            : null;

        const submitProfile = () => {
          setError("");
          const result = onProfileContinue({
            displayName,
            handle,
            icePreset,
          });
          if (result && result.error) setError(result.error);
        };

        const pasteLabel =
          phase === "shareReply"
            ? "Paste is disabled — show your reply"
            : phase === "shareInvite"
              ? "Paste their reply (or their invite if you are joining)"
              : "Paste peer code";

        return tpl`
          <div class="wizard frame" data-theme="${theme}">
            <div class="card">
              ${
                statusBanner
                  ? tpl`<div class="banner" role="status">${statusBanner}</div>`
                  : null
              }
              ${
                phase === "profile"
                  ? tpl`
                      <h1>Set up your profile</h1>
                      <p class="lead">
                        Local Meet identity for this vault. Relay presets feed WebRTC ICE.
                      </p>
                      <div class="field">
                        <dimui-text-field
                          .props="${{
                            id: "displayName",
                            label: "Display name",
                            value: displayName,
                            onInput: setDisplayName,
                          }}"
                        />
                      </div>
                      <div class="field">
                        <dimui-text-field
                          .props="${{
                            id: "handle",
                            label: "Handle",
                            value: handle,
                            onInput: setHandle,
                          }}"
                        />
                      </div>
                      <div class="field">
                        <label class="label" for="ice-preset">Relay servers</label>
                        <select
                          id="ice-preset"
                          .value="${icePreset}"
                          @change="${(e) => setIcePreset(e.target.value)}"
                        >
                          ${ICE_PRESETS.map(
                            (p) =>
                              tpl`<option value="${p.id}">${p.label}</option>`,
                          )}
                        </select>
                      </div>
                      ${error ? tpl`<p class="banner">${error}</p>` : null}
                      <dimui-button
                        .props="${{
                          label: "Continue",
                          onClick: submitProfile,
                        }}"
                      />
                    `
                  : null
              }
              ${
                phase === "shareInvite" || phase === "shareReply"
                  ? tpl`
                      <h1>${phase === "shareReply" ? "Share your reply" : "Share your invite"}</h1>
                      <p class="lead">
                        Codes bundle SDP and ICE (no trickle). Paste the peer’s code to continue.
                      </p>
                      <dimim-share-code-panel
                        .props="${{
                          localCode,
                          minting,
                          pasteLabel,
                          onPasteCode:
                            phase === "shareReply"
                              ? () => {}
                              : onPasteCode,
                          onScan: () => setScannerOpen(true),
                        }}"
                      />
                    `
                  : null
              }
              ${
                phase === "connecting"
                  ? tpl`
                      <h1>Connecting</h1>
                      <div class="connecting">Waiting for the data channel…</div>
                    `
                  : null
              }
              ${
                onEditProfile && phase !== "profile"
                  ? tpl`
                      <div class="edit-profile">
                        <button type="button" @click="${onEditProfile}">
                          Edit profile
                        </button>
                      </div>
                    `
                  : null
              }
            </div>
            <dimui-qr-scanner
              .props="${{
                open: scannerOpen,
                title: "Scan peer code",
                onClose: () => setScannerOpen(false),
                onDetect: (code) => {
                  setScannerOpen(false);
                  if (phase === "shareReply") return;
                  onPasteCode(String(code || ""));
                },
              }}"
            />
          </div>
        `;
      },
    });

    return { PairingWizard };
  },
);
