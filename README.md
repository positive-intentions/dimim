<p align="center">
  <img src="public/dim.png" alt="Dim Framework Logo" width="200" />
</p>

<h1 align="center">dimim</h1>

<p align="center">
  <strong>Encrypted Meet — 1:1 WebRTC messaging built with Dim</strong>
</p>

<p align="center">
  No app-side transpile, no npm install, no bundler. Open
  <a href="./index.html"><code>index.html</code></a> in Chrome
  (<code>file://</code> works).
</p>

<div align="center">

[**Live**](https://dim.glitr.io) | [**Tests**](https://dim.glitr.io/runTests.html) | [**dim**](https://github.com/positive-intentions/dim) | [**dimui**](https://github.com/positive-intentions/dimui) | [**dim-boilerplate**](https://github.com/positive-intentions/dim-boilerplate)

</div>

---

Your **application logic** is ordinary `.js` files in this repo. The Dim
runtime and reusable [dimui](https://github.com/positive-intentions/dimui)
widgets load from their GitHub Pages CDNs over the network.

## What this is

A 1:1 encrypted chat app structured like
[dim-boilerplate](https://github.com/positive-intentions/dim-boilerplate),
with an **out-of-band invite → reply** WebRTC handshake:

1. Create / unlock an encrypted browser vault
2. Set a local profile + ICE preset
3. Mint a bundled offer (`wu1:` or raw JSON: SDP + ICE, no trickle)
4. Peer pastes the invite, returns an answer bundle
5. Data channel opens — chat, receipts, typing, files, and in-band voice/video

Messages travel on the WebRTC **DTLS-SCTP** data channel (browser default).
App-layer sealing and git mailbox are out of scope for this pass.

## Quick start (two tabs)

Open [`index.html`](./index.html) twice (two tabs or two browsers) via
`file://`, or if you need a URL origin (camera, some WebRTC setups):

```bash
npx --yes serve -l 4173
```

1. Tab A: create a vault → profile → copy the invite code (or scan the QR)
2. Tab B: create a vault (different password) → profile → paste A’s invite → copy the reply
3. Tab A: paste B’s reply
4. Both sides enter the thread when the data channel + `hello` frame land
5. Send text, attach small files, try voice/video (camera permission required)

Runtimes: `?impl=js` or `?impl=wasm` (also in the header).

### Local dimui (QR encode/scan before Pages deploy)

dimui widgets load from the GitHub Pages CDN by default. To use a local
checkout of unpublished atoms (e.g. `dimui-qr-code` / `dimui-qr-scanner`),
serve both trees and point dimim at local dimui with `?dimuiSrc=`:

```bash
# terminal A — dimui src/
npx --yes serve ../dimui -l 4174

# terminal B — dimim
npx --yes serve . -l 4173
# App:   http://127.0.0.1:4173/?dimuiSrc=http://127.0.0.1:4174/src/
# Tests: http://127.0.0.1:4173/runTests.html?dimuiSrc=http://127.0.0.1:4174/src/
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
    ├── lib/          # vault, peer, frames, pairing, messages, qr-payload
    └── components/
        ├── atoms/    # proxies → remote dimui
        ├── molecules/
        ├── organisms/
        ├── templates/
        └── pages/meet-app/
```

## Tests

Dim ships a **pure-JS** test runner ([`DimTest`](https://github.com/positive-intentions/dim)) —
no Jest/Vitest/Playwright required to author or run specs. Specs are plain
classic scripts next to sources (`*.test.js`) that call `DimTest.test` /
`DimTest.e2e`, mount real Dim custom elements, and assert on shadow DOM.

Open [`runTests.html`](./runTests.html) the same way as the app
(`file://` or `npx serve`):

```bash
# file:// — open runTests.html in Chrome
# or:
npx --yes serve -l 4173
# then open http://127.0.0.1:4173/runTests.html
```

### What `runTests.html` does

1. Loads Dim + `DimTest` (+ coverage helper) from the Dim CDN
2. Installs the same `BP` module shim as the app (`runtime.js`)
3. **Instruments** every `chat/**` source with line probes, then loads the
   matching `*.test.js` files
4. Runs the suite in the page: unit tests first, then e2e

The page itself is the report UI:

- Splash while Dim / sources / tests load
- Pass/fail list with expandable errors
- Live **coverage** panel for instrumented `chat/**` (unit bucket targets
  **100%**; peer uses a mock `RTCPeerConnection`)
- **E2E preview**: `DimTest.open` (and two-peer helpers that wrap it) render
  the real app under the report — peers appear side-by-side for handshake flows

Useful query flags: `?impl=js|wasm`, `?dimuiSrc=…`, `?dimLib=…`.

E2E specs:

- [`chat/e2e/meet-app.e2e.test.js`](./chat/e2e/meet-app.e2e.test.js) — vault + invite mint
- [`chat/e2e/p2p.e2e.test.js`](./chat/e2e/p2p.e2e.test.js) — two isolated iframes; the
  controller copies invite/reply between them (no mock peer)

## Explicitly later

Onion/`on1:`, NFC, git mailbox, app-layer message sealing, groups/chat list.

## Related

- [dim-boilerplate](https://github.com/positive-intentions/dim-boilerplate) — encrypted notes reference app
- [dimui messaging demo](https://github.com/positive-intentions/dimui/tree/staging/src/demos/messaging) — multi-chat explorer demo (out of scope here)
