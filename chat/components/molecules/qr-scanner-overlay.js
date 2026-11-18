BP.module(
  "chat/components/molecules/qr-scanner-overlay",
  ["chat/components/molecules/qr-scanner"],
  function (qrScanner) {
    const { define, css } = Dim;
    const { QrScanner } = qrScanner;

    const styles = css`
      :host {
        display: contents;
      }
    `;

    const QrScannerOverlay = define({
      tag: "dimim-qr-scanner-overlay",
      component: (props, { html: tpl, useStyle: style, useScope: scope }) => {
        style(styles);
        scope({ QrScanner });

        const open = Boolean(props.open);
        const onClose =
          typeof props.onClose === "function" ? props.onClose : () => {};
        const onDetect =
          typeof props.onDetect === "function"
            ? props.onDetect
            : typeof props.onPasteCode === "function"
              ? props.onPasteCode
              : () => {};

        return tpl`
          <dimui-qr-scanner
            .props="${{
              open,
              title: props.title || "Scan peer code",
              onClose,
              onDetect: (text) => {
                onDetect(String(text || ""));
              },
            }}"
          />
        `;
      },
    });

    return { QrScannerOverlay };
  },
);
