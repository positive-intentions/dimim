BP.module(
  "chat/components/organisms/call-screen",
  ["chat/components/atoms/button"],
  function (button) {
    const { define, css } = Dim;
    const { Button } = button;

    const styles = css`
      :host {
        display: contents;
      }

      .call {
        position: fixed;
        inset: 0;
        z-index: 1300;
        background: #020617;
        color: #e2e8f0;
        display: none;
        flex-direction: column;
      }

      .call.open {
        display: flex;
      }

      .call.mini {
        inset: auto;
        right: 1rem;
        bottom: 1rem;
        width: min(280px, calc(100vw - 2rem));
        height: 180px;
        border-radius: 16px;
        border: 1px solid #334155;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
      }

      .stage {
        flex: 1;
        display: grid;
        place-items: center;
        background: #0f172a;
        position: relative;
        overflow: hidden;
      }

      video.remote {
        width: 100%;
        height: 100%;
        object-fit: cover;
        background: #020617;
      }

      video.local {
        position: absolute;
        right: 0.75rem;
        bottom: 0.75rem;
        width: 96px;
        height: 128px;
        border-radius: 12px;
        object-fit: cover;
        border: 1px solid #475569;
        background: #1e293b;
      }

      .overlay-label {
        position: absolute;
        top: 1rem;
        left: 1rem;
        z-index: 2;
      }

      .peer-label {
        font-size: 1.1rem;
        font-weight: 650;
      }

      .phase {
        margin-top: 0.25rem;
        color: #94a3b8;
        font-size: 0.85rem;
      }

      .controls {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0.85rem;
        background: #0b1220;
        border-top: 1px solid #1e293b;
      }

      .call.mini video.local {
        display: none;
      }
    `;

    const CallScreen = define({
      tag: "dimim-call-screen",
      component: (
        props,
        {
          html: tpl,
          useState: state,
          useEffect: effect,
          useRef: ref,
          useStyle: style,
          useScope: scope,
        },
      ) => {
        style(styles);
        scope({ Button });

        const open = Boolean(props.open);
        const peer = props.peer || {};
        const kind = props.kind === "video" ? "video" : "voice";
        const phase = props.phase || "active";
        const minimized = Boolean(props.minimized);
        const localStream = props.localStream || null;
        const remoteStream = props.remoteStream || null;
        const sharing = Boolean(props.sharing);

        const onEnd =
          typeof props.onEnd === "function" ? props.onEnd : () => {};
        const onToggleMinimize =
          typeof props.onToggleMinimize === "function"
            ? props.onToggleMinimize
            : () => {};
        const onToggleMute =
          typeof props.onToggleMute === "function"
            ? props.onToggleMute
            : () => {};
        const onToggleCamera =
          typeof props.onToggleCamera === "function"
            ? props.onToggleCamera
            : () => {};
        const onToggleShare =
          typeof props.onToggleShare === "function"
            ? props.onToggleShare
            : () => {};

        const [muted, setMuted] = state(false);
        const [cameraOn, setCameraOn] = state(kind === "video");
        const remoteRef = ref();
        const localRef = ref();

        effect(() => {
          const el = remoteRef.current;
          if (!el) return;
          try {
            if (
              remoteStream &&
              typeof MediaStream !== "undefined" &&
              remoteStream instanceof MediaStream
            ) {
              el.srcObject = remoteStream;
            }
          } catch (e) {}
        }, [remoteStream, open]);

        effect(() => {
          const el = localRef.current;
          if (!el) return;
          try {
            if (
              localStream &&
              typeof MediaStream !== "undefined" &&
              localStream instanceof MediaStream
            ) {
              el.srcObject = localStream;
            }
          } catch (e) {}
        }, [localStream, open]);

        const name = peer.displayName || "Peer";

        return tpl`
          <div class="call ${open ? "open" : ""} ${minimized ? "mini" : ""}" data-call-open="${open ? "1" : "0"}">
            <div class="stage">
              <video class="remote" ref=${remoteRef} autoplay playsinline></video>
              ${
                kind === "video"
                  ? tpl`<video class="local" ref=${localRef} autoplay playsinline muted></video>`
                  : null
              }
              <div class="overlay-label">
                <div class="peer-label">${name}</div>
                <div class="phase">${phase} · ${kind}${sharing ? " · sharing" : ""}</div>
              </div>
            </div>
            <div class="controls">
              <dimui-button
                .props="${{
                  label: muted ? "Unmute" : "Mute",
                  variant: "outlined",
                  size: "sm",
                  onClick: () => {
                    const next = !muted;
                    setMuted(next);
                    onToggleMute(!next);
                  },
                }}"
              />
              ${
                kind === "video"
                  ? tpl`
                      <dimui-button
                        .props="${{
                          label: cameraOn ? "Camera off" : "Camera on",
                          variant: "outlined",
                          size: "sm",
                          onClick: () => {
                            const next = !cameraOn;
                            setCameraOn(next);
                            onToggleCamera(next);
                          },
                        }}"
                      />
                      <dimui-button
                        .props="${{
                          label: sharing ? "Stop share" : "Share",
                          variant: "outlined",
                          size: "sm",
                          onClick: onToggleShare,
                        }}"
                      />
                    `
                  : null
              }
              <dimui-button
                .props="${{
                  label: minimized ? "Expand" : "Minimize",
                  variant: "outlined",
                  size: "sm",
                  onClick: onToggleMinimize,
                }}"
              />
              <dimui-button
                .props="${{
                  label: "End",
                  variant: "danger",
                  size: "sm",
                  onClick: onEnd,
                }}"
              />
            </div>
          </div>
        `;
      },
    });

    return { CallScreen };
  },
);
