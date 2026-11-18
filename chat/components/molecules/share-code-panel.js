BP.module(
  "chat/components/molecules/share-code-panel",
  [
    "chat/components/atoms/button",
    "chat/components/atoms/text-field",
    "chat/components/atoms/qr-code",
    "chat/lib/qr-payload",
    "chat/lib/qr-png",
    "dimui/lib/qr-decode",
  ],
  function (button, textField, qrCode, qrPayload, qrPng, qrDecode) {
    const { define, css } = Dim;
    const { Button } = button;
    const { TextField } = textField;
    const { QrCode } = qrCode;
    const FILENAME = "connection-code.png";

    const styles = css`
      :host {
        display: block;
      }

      .panel {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .qr {
        width: min(236px, 70vw);
        margin: 0 auto;
        display: grid;
        place-items: center;
      }

      .qr-placeholder {
        width: min(220px, 70vw);
        aspect-ratio: 1;
        border-radius: 16px;
        border: 1px dashed var(--chat-border, #334155);
        background: var(--chat-surface-2, #1e293b);
        display: grid;
        place-items: center;
        color: var(--chat-text-muted, #94a3b8);
        font-size: 0.85rem;
        text-align: center;
        padding: 1rem;
      }

      .code {
        font-family: ui-monospace, Menlo, monospace;
        font-size: 0.8rem;
        word-break: break-all;
        color: var(--chat-text, #e2e8f0);
        background: var(--chat-surface-2, #1e293b);
        border-radius: 10px;
        padding: 0.65rem 0.75rem;
        border: 1px solid var(--chat-border, #334155);
      }

      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .paste-row {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .busy {
        color: var(--chat-text-muted, #94a3b8);
        font-size: 0.85rem;
      }

      .hint {
        color: var(--chat-text-muted, #94a3b8);
        font-size: 0.85rem;
        margin: 0;
      }

      .file-input {
        position: fixed;
        left: 0;
        top: 0;
        width: 1px;
        height: 1px;
        opacity: 0;
        overflow: hidden;
        pointer-events: none;
      }
    `;

    function findQrSvg(host) {
      if (!host) return null;
      try {
        var qr = host.querySelector("dimui-qr-code");
        if (!qr || !qr.shadowRoot) return null;
        return qr.shadowRoot.querySelector("svg");
      } catch (e) {
        return null;
      }
    }

    const ShareCodePanel = define({
      tag: "dimim-share-code-panel",
      component: (
        props,
        {
          html: tpl,
          useState: state,
          useRef: ref,
          useStyle: style,
          useScope: scope,
          useEffect: effect,
        },
      ) => {
        style(styles);
        scope({ Button, TextField, QrCode });

        const localCode = props.localCode || "";
        const minting = Boolean(props.minting);
        const pasteLabel = props.pasteLabel || "Paste peer code";
        const [paste, setPaste] = state("");
        const [copied, setCopied] = state(false);
        const [showMore, setShowMore] = state(true);
        const [qrValue, setQrValue] = state("");
        const [qrBusy, setQrBusy] = state(false);
        const [canShare, setCanShare] = state(false);
        const [hint, setHint] = state("");
        const pasteRowRef = ref();
        const panelRef = ref();
        const fileRef = ref();

        const onCopy =
          typeof props.onCopy === "function" ? props.onCopy : () => {};
        const onPasteCode =
          typeof props.onPasteCode === "function"
            ? props.onPasteCode
            : () => {};
        const onScan =
          typeof props.onScan === "function" ? props.onScan : () => {};

        const qrReady = Boolean(localCode && qrValue && !minting);

        effect(() => {
          setCanShare(Boolean(qrPng.canSharePng && qrPng.canSharePng()));
        }, []);

        effect(() => {
          if (!localCode) {
            setQrValue("");
            setQrBusy(false);
            return undefined;
          }
          var cancelled = false;
          setQrBusy(true);
          qrPayload
            .forQr(localCode)
            .then(function (fitted) {
              if (!cancelled) {
                setQrValue(fitted);
                setQrBusy(false);
              }
            })
            .catch(function () {
              if (!cancelled) {
                setQrValue("");
                setQrBusy(false);
              }
            });
          return function () {
            cancelled = true;
          };
        }, [localCode]);

        const copy = async () => {
          if (!localCode) return;
          setHint("");
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(localCode);
            }
          } catch (e) {}
          setCopied(true);
          onCopy(localCode);
        };

        const applyPaste = () => {
          var live = paste;
          try {
            var row = pasteRowRef.current;
            var field = row && row.querySelector("dimui-text-field");
            var input =
              field &&
              field.shadowRoot &&
              field.shadowRoot.querySelector("input, textarea");
            if (input && String(input.value || "").length) {
              live = input.value;
            }
          } catch (e) {}
          setHint("");
          onPasteCode(live);
        };

        const rasterize = async () => {
          var svg = findQrSvg(panelRef.current);
          if (!svg) {
            setHint("QR isn’t ready yet. Wait a moment and try again.");
            return null;
          }
          try {
            return await qrPng.pngBlobFromSvg(svg, 512);
          } catch (e) {
            setHint("QR isn’t ready yet. Wait a moment and try again.");
            return null;
          }
        };

        const saveQr = async () => {
          if (!qrReady) {
            setHint("QR isn’t ready yet. Wait a moment and try again.");
            return;
          }
          setHint("");
          var blob = await rasterize();
          if (!blob) return;
          var result = qrPng.downloadPng(blob, FILENAME);
          if (result === "unsupported") {
            setHint(
              canShare
                ? "Couldn’t save here — try Share QR Code instead."
                : "Couldn’t save the QR here. Copy the code or take a screenshot.",
            );
          }
        };

        const shareQr = async () => {
          if (!qrReady) {
            setHint("QR isn’t ready yet. Wait a moment and try again.");
            return;
          }
          setHint("");
          var blob = await rasterize();
          if (!blob) return;
          var result = await qrPng.sharePng(blob, FILENAME, "Meet code");
          if (result === "abort") return;
          if (result === "gesture") {
            setHint("Tap Share QR Code again to continue.");
            return;
          }
          if (result === "unsupported" || result === "fail") {
            setHint(
              "Couldn’t share the QR here. Try Save QR Code or copy the code.",
            );
          }
        };

        const pickUpload = () => {
          setHint("");
          var input = fileRef.current;
          if (input) input.click();
        };

        const onFileChange = async (ev) => {
          var file = ev.target && ev.target.files && ev.target.files[0];
          if (ev.target) ev.target.value = "";
          if (!file) return;
          setHint("");
          var text = null;
          try {
            text = await qrDecode.decodeImageFile(file);
          } catch (e) {
            text = null;
          }
          if (text) {
            onPasteCode(String(text));
            return;
          }
          setHint("No QR code found in that image.");
        };

        return tpl`
          <div class="panel" ref=${panelRef}>
            <div class="qr">
              ${
                localCode && qrValue
                  ? tpl`<dimui-qr-code
                      .props="${{
                        value: qrValue,
                        size: 220,
                        level: "L",
                        alt: "Invite QR code",
                      }}"
                    />`
                  : tpl`<div class="qr-placeholder" aria-hidden="true">
                      ${
                        minting
                          ? "Minting…"
                          : localCode
                            ? qrBusy
                              ? "Preparing QR…"
                              : "QR unavailable — copy the code"
                            : "Waiting for invite…"
                      }
                    </div>`
              }
            </div>
            <div class="code" data-invite-code="${localCode}">
              ${minting ? "Minting invite…" : localCode || "—"}
            </div>
            ${minting ? tpl`<div class="busy">Gathering ICE candidates…</div>` : null}
            <div class="row">
              <dimui-button
                .props="${{
                  label: copied ? "Copied" : "Copy code",
                  disabled: !localCode || minting,
                  onClick: copy,
                }}"
              />
              <dimui-button
                .props="${{
                  label: "Scan their code",
                  variant: "outlined",
                  onClick: onScan,
                }}"
              />
              <dimui-button
                .props="${{
                  label: "Save QR Code",
                  variant: "outlined",
                  disabled: !qrReady,
                  onClick: saveQr,
                }}"
              />
              ${
                canShare
                  ? tpl`<dimui-button
                      .props="${{
                        label: "Share QR Code",
                        variant: "outlined",
                        disabled: !qrReady,
                        onClick: shareQr,
                      }}"
                    />`
                  : null
              }
              <input
                class="file-input"
                type="file"
                accept="image/*"
                tabindex="-1"
                ref=${fileRef}
                @change=${onFileChange}
              />
              <dimui-button
                .props="${{
                  label: "Upload QR Code",
                  variant: "outlined",
                  onClick: pickUpload,
                }}"
              />
            </div>
            ${hint ? tpl`<p class="hint" role="status">${hint}</p>` : null}
            <dimui-button
              .props="${{
                label: showMore ? "Hide paste" : "Paste peer code",
                variant: "text",
                size: "sm",
                onClick: () => setShowMore(!showMore),
              }}"
            />
            ${
              showMore
                ? tpl`
                    <div class="paste-row" ref=${pasteRowRef}>
                      <dimui-text-field
                        .props="${{
                          id: "paste-code",
                          label: pasteLabel,
                          value: paste,
                          onInput: setPaste,
                        }}"
                      />
                      <div class="row">
                        <dimui-button
                          .props="${{
                            label: "Use pasted code",
                            size: "sm",
                            onClick: applyPaste,
                          }}"
                        />
                      </div>
                    </div>
                  `
                : null
            }
          </div>
        `;
      },
    });

    return { ShareCodePanel };
  },
);
