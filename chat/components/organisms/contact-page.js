/**
 * Proxy for remote dimui ContactDetails — see dimui/src/components/messaging/organisms/contact-details.js
 */
BP.module(
  "chat/components/organisms/contact-page",
  ["dimui/components/messaging/organisms/contact-details"],
  function (mod) {
    return { ContactDetails: mod.ContactDetails };
  },
);
