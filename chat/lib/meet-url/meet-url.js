BP.module("chat/lib/meet-url", ["dimurl/hash"], function (hashApi) {
  var normalizePath = hashApi.normalizePath;

  var SCREENS = {
    pair: "pair",
    chat: "chat",
    profile: "profile",
    contact: "contact",
  };

  /**
   * Serialize Meet UI screen to a hash pathname.
   * @param {{ screen?: string }} loc
   * @returns {string} pathname e.g. "/pair", "/chat", "/profile", "/contact"
   */
  function toLocation(loc) {
    loc = loc || {};
    var screen = loc.screen != null ? String(loc.screen) : "";
    if (screen === SCREENS.chat) return "/chat";
    if (screen === SCREENS.profile) return "/profile";
    if (screen === SCREENS.contact) return "/contact";
    return "/pair";
  }

  /**
   * Parse a hash pathname into Meet UI location.
   * @param {string} path
   * @returns {{ screen: string|null }}
   */
  function fromLocation(path) {
    var p = normalizePath(path);

    if (p === "/" || p === "/pair") {
      return { screen: SCREENS.pair };
    }
    if (p === "/chat") {
      return { screen: SCREENS.chat };
    }
    if (p === "/profile") {
      return { screen: SCREENS.profile };
    }
    if (p === "/contact") {
      return { screen: SCREENS.contact };
    }

    return { screen: null };
  }

  return {
    SCREENS: SCREENS,
    toLocation: toLocation,
    fromLocation: fromLocation,
  };
});
