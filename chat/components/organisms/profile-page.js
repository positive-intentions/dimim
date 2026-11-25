/**
 * Proxy for remote dimui Profile — see dimui/src/components/messaging/organisms/profile.js
 */
BP.module(
  "chat/components/organisms/profile-page",
  ["dimui/components/messaging/organisms/profile"],
  function (mod) {
    return { Profile: mod.Profile };
  },
);
