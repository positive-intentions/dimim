/**
 * Proxy for remote dimui Composer
 */
BP.module(
  "chat/components/molecules/composer",
  ["dimui/components/messaging/molecules/composer"],
  function (mod) {
    return { Composer: mod.Composer };
  },
);
