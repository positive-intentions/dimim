/**
 * Proxy for remote dimui UnlockScreen — see dimui/src/components/molecules/unlock-screen.js
 * Meet-specific title/copy are applied by meet-app when mounting.
 */
BP.module(
  "chat/components/organisms/unlock-screen",
  ["dimui/components/molecules/unlock-screen"],
  function (mod) {
    return { UnlockScreen: mod.UnlockScreen };
  },
);
