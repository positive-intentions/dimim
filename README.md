<p align="center">
  <img src="public/dim.png" alt="Dim Framework Logo" width="200" />
</p>

<h1 align="center">dimim</h1>

<p align="center">
  <strong>Encrypted Meet — 1:1 WebRTC messaging built with Dim</strong>
</p>

<p align="center">
  No app-side transpile, no npm install, no bundler. Open
  <a href="./index.html"><code>index.html</code></a> in Chrome or use a local static server.
</p>

<div align="center">

[**dim**](https://github.com/positive-intentions/dim) | [**dimui**](https://github.com/positive-intentions/dimui) | [**dim-boilerplate**](https://github.com/positive-intentions/dim-boilerplate) | [**webrtc**](https://github.com/positive-intentions/webrtc)

</div>

---

Your **application logic** is ordinary `.js` files in this repo. The Dim
runtime and reusable [dimui](https://github.com/positive-intentions/dimui)
widgets load from their GitHub Pages CDNs over the network.

## What this is

A Meet-style 1:1 app structured like [dim-boilerplate](https://github.com/positive-intentions/dim-boilerplate),
with the same **out-of-band invite → reply** handshake as
[webrtc Meet](https://github.com/positive-intentions/webrtc):

1. Create / unlock an encrypted browser vault
2. Set a local profile + ICE preset
3. Mint a bundled offer (`wu1:` or raw JSON: SDP + ICE, no trickle)
4. Peer pastes the invite, returns an answer bundle
5. Data channel opens — chat, receipts, typing, files, and in-band voice/video

Messages travel on the WebRTC **DTLS-SCTP** data channel (browser default).
App-layer sealing and git mailbox are out of scope for this pass.

## Quick start (two tabs)

```bash
python3 -m http.server 4173
# Open http://127.0.0.1:4173/ in two browser tabs (or two browsers)
```

1. Tab A: create a vault → profile → copy the invite code
2. Tab B: create a vault (different password) → profile → paste A’s invite → copy the reply
3. Tab A: paste B’s reply
4. Both sides enter the thread when the data channel + `hello` frame land
5. Send text, attach small files, try voice/video (camera permission required)

Runtimes: `?impl=js` or `?impl=wasm` (also in the header).

### Local dimui (QR encode/scan before Pages deploy)

dimui widgets load from the GitHub Pages CDN by default. To use a local
checkout of unpublished atoms (e.g. `dimui-qr-code` / `dimui-qr-scanner`):

```bash
# terminal A — dimui explorer / src tree
cd ../dimui && python3 -m http.server 4174 --bind 127.0.0.1

# terminal B — dimim
python3 -m http.server 4173 --bind 127.0.0.1
# Open http://127.0.0.1:4173/?dimuiSrc=http://127.0.0.1:4174/src/
# Tests: http://127.0.0.1:4173/runTests.html?dimuiSrc=http://127.0.0.1:4174/src/
# Or: DIMUI_SRC=http://127.0.0.1:4174/src/ node .github/scripts/run-app-tests.mjs
```

## Tree

```
dimim/
├── index.html
├── runTests.html
├── runtime.js
├── app.js
├── pwa.js
├── sw.js
├── manifest.webmanifest
└── chat/
    ├── e2e/          # helpers + single-iframe + two-iframe p2p
    ├── lib/          # vault, peer, frames, pairing, messages
    └── components/
        ├── atoms/    # proxies → remote dimui
        ├── molecules/
        ├── organisms/
        ├── templates/
        └── pages/meet-app/
```

## Tests

```bash
python3 -m http.server 4173
# Open http://127.0.0.1:4173/runTests.html
```

Specs sit next to sources (`*.test.js`) plus:

- [`chat/e2e/meet-app.e2e.test.js`](./chat/e2e/meet-app.e2e.test.js) — vault + invite mint
- [`chat/e2e/p2p.e2e.test.js`](./chat/e2e/p2p.e2e.test.js) — two isolated iframes; the test
  controller copies invite/reply between them (no mock peer)

CI runs JS + WASM via Playwright with
`--use-fake-ui-for-media-stream` / `--use-fake-device-for-media-stream`.
Unit coverage of instrumented `chat/**` aims for **100%** (peer uses a mock `RTCPeerConnection`).

## Explicitly later

Onion/`on1:`, NFC, git mailbox, app-layer message sealing, groups/chat list.

## Related

- [dim-boilerplate](https://github.com/positive-intentions/dim-boilerplate) — encrypted notes reference app
- [dimui messaging demo](https://github.com/positive-intentions/dimui/tree/staging/src/demos/messaging) — multi-chat explorer demo (out of scope here)
- [webrtc Meet](https://github.com/positive-intentions/webrtc) — reference P2P Meet handshake
