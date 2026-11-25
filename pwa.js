/**
 * Registers the service worker (HTTPS / localhost only), harvests loaded
 * Dim / dimui / dimurl resource URLs for offline cache, and exposes
 * install-prompt helpers for an in-app Install button (beforeinstallprompt
 * + iOS tip).
 */
(function () {
  var CDN_ORIGIN = "https://positive-intentions.github.io";
  var listeners = [];
  var deferredPrompt = null;

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
        return true;
      }
    } catch (e) {}
    return !!(navigator.standalone);
  }

  function isIos() {
    var ua = navigator.userAgent || "";
    var iOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return iOS;
  }

  function isSafari() {
    var ua = navigator.userAgent || "";
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium/.test(ua);
  }

  function notify() {
    var snap = getSnapshot();
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](snap);
      } catch (e) {}
    }
  }

  function getSnapshot() {
    var standalone = isStandalone();
    var ios = isIos();
    return {
      canInstall: !standalone && !!deferredPrompt,
      showIosTip: !standalone && ios && isSafari(),
      isStandalone: standalone,
      insecure:
        !standalone &&
        location.protocol !== "https:" &&
        location.hostname !== "localhost" &&
        location.hostname !== "127.0.0.1",
    };
  }

  function subscribe(cb) {
    if (typeof cb !== "function") return function () {};
    listeners.push(cb);
    try {
      cb(getSnapshot());
    } catch (e) {}
    return function unsubscribe() {
      var idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  function promptInstall() {
    if (!deferredPrompt) return Promise.resolve({ outcome: "dismissed" });
    var event = deferredPrompt;
    deferredPrompt = null;
    notify();
    event.prompt();
    return event.userChoice
      .then(function (choice) {
        notify();
        return choice;
      })
      .catch(function () {
        notify();
        return { outcome: "dismissed" };
      });
  }

  globalThis.DimPwa = {
    subscribe: subscribe,
    promptInstall: promptInstall,
    getSnapshot: getSnapshot,
  };

  if (!isStandalone()) {
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      notify();
    });

    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      notify();
    });
  }

  if (!("serviceWorker" in navigator) || location.protocol === "file:") {
    return;
  }

  function isHarvestable(url) {
    if (!url || typeof url !== "string") return false;
    if (url.indexOf(CDN_ORIGIN + "/dim/") === 0) return true;
    if (url.indexOf(CDN_ORIGIN + "/dimui/") === 0) return true;
    if (url.indexOf(CDN_ORIGIN + "/dimurl/") === 0) return true;
    // Proxy paths under this app (later visits)
    if (url.indexOf("/pwa/cdn/dim/") !== -1) return true;
    if (url.indexOf("/pwa/cdn/dimui/") !== -1) return true;
    if (url.indexOf("/pwa/cdn/dimurl/") !== -1) return true;
    return false;
  }

  function collectLoadedUrls() {
    var seen = Object.create(null);
    var out = [];

    function add(url) {
      if (!isHarvestable(url) || seen[url]) return;
      seen[url] = true;
      out.push(url);
    }

    try {
      var entries = performance.getEntriesByType("resource");
      for (var i = 0; i < entries.length; i++) {
        add(entries[i].name);
      }
    } catch (e) {}

    try {
      var scripts = document.getElementsByTagName("script");
      for (var j = 0; j < scripts.length; j++) {
        if (scripts[j].src) add(scripts[j].src);
      }
    } catch (e) {}

    return out;
  }

  function postCacheUrls(worker) {
    var urls = collectLoadedUrls();
    if (!urls.length || !worker) return;
    worker.postMessage({ type: "CACHE_URLS", urls: urls });
  }

  function scheduleHarvest(registration) {
    function send() {
      var worker =
        (registration && registration.active) ||
        navigator.serviceWorker.controller;
      postCacheUrls(worker);
    }

    if (document.readyState === "complete") {
      // Give dimui dynamic imports a moment to finish.
      setTimeout(send, 1500);
    } else {
      window.addEventListener("load", function () {
        setTimeout(send, 1500);
      });
    }
  }

  navigator.serviceWorker
    .register("./sw.js")
    .then(function (registration) {
      scheduleHarvest(registration);
      // When a new worker takes control, harvest again under proxy URLs.
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        scheduleHarvest(registration);
      });
    })
    .catch(function (err) {
      console.warn(
        "[pwa] service worker registration failed (install needs HTTPS or localhost):",
        err,
      );
      notify();
    });
})();
