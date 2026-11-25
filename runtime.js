/**
 * Runs after the inline index.html script has sync-loaded window.Dim
 * from https://positive-intentions.github.io/dim/lib/dim*.global.js.
 *
 * Exposes globalThis.BP — a tiny AMD-style module registry used by the
 * local classic-script chat components (local ES modules are blocked on
 * file:// in Chrome).
 *
 * Remote dimui / dimurl modules load as classic scripts via <script src>
 * when a BP dep starts with "dimui/" or "dimurl/". Those scripts call
 * BP.module into this page's registry. Dim itself is a classic remote IIFE
 * (not import()) so window.Dim exists before this shim is built.
 */
(function () {
  var CDN_DIMUI_SRC = "https://positive-intentions.github.io/dimui/src/";
  var CDN_DIMURL_SRC = "https://positive-intentions.github.io/dimurl/src/";
  var CDN_DIM_LIB = "https://positive-intentions.github.io/dim/lib/";
  // When a service worker already controls the page, route Dim/dimui/dimurl
  // through same-scope proxy paths so the worker can intercept and serve
  // them offline.
  var controlled =
    typeof navigator !== "undefined" &&
    navigator.serviceWorker &&
    navigator.serviceWorker.controller;
  var DIMUI_SRC = controlled ? "./pwa/cdn/dimui/src/" : CDN_DIMUI_SRC;
  var DIMURL_SRC = controlled ? "./pwa/cdn/dimurl/src/" : CDN_DIMURL_SRC;
  var DIM_LIB = controlled ? "./pwa/cdn/dim/lib/" : CDN_DIM_LIB;
  // Srcdoc e2e iframes (about:srcdoc) have no query string — inherit from parent.
  try {
    if (window.parent && window.parent !== window) {
      var parentDimim = window.parent.__DIMIM__;
      if (parentDimim && parentDimim.dimuiSrc) {
        DIMUI_SRC = parentDimim.dimuiSrc;
      }
      if (parentDimim && parentDimim.dimurlSrc) {
        DIMURL_SRC = parentDimim.dimurlSrc;
      }
      if (parentDimim && parentDimim.dimLib) {
        DIM_LIB = parentDimim.dimLib;
      }
    }
  } catch (eParent) {}
  // Query overrides win (local dimui / dimurl while developing):
  // ?dimuiSrc=http://127.0.0.1:5173/src/&dimurlSrc=http://127.0.0.1:5180/src/
  try {
    var params = new URLSearchParams(location.search || "");
    var dimuiSrcQ = params.get("dimuiSrc") || "";
    if (dimuiSrcQ) {
      DIMUI_SRC =
        dimuiSrcQ.charAt(dimuiSrcQ.length - 1) === "/"
          ? dimuiSrcQ
          : dimuiSrcQ + "/";
    }
    var dimurlSrcQ = params.get("dimurlSrc") || "";
    if (dimurlSrcQ) {
      DIMURL_SRC =
        dimurlSrcQ.charAt(dimurlSrcQ.length - 1) === "/"
          ? dimurlSrcQ
          : dimurlSrcQ + "/";
    }
    var dimLibQ = params.get("dimLib") || "";
    if (dimLibQ) {
      DIM_LIB =
        dimLibQ.charAt(dimLibQ.length - 1) === "/" ? dimLibQ : dimLibQ + "/";
    }
  } catch (e) {}

  if (!globalThis.Dim) {
    throw new Error(
      "Dim global missing. The inline script in index.html should have loaded " +
        CDN_DIM_LIB +
        "dim.global.js (or dim.wasm.global.js).",
    );
  }

  globalThis.__DIMIM__ = {
    impl: document.documentElement.dataset.dimRuntime || "js",
    dimuiSrc: DIMUI_SRC,
    dimurlSrc: DIMURL_SRC,
    dimLib: DIM_LIB,
    pwaControlled: !!controlled,
  };

  // -------------------------------------------------------------------------
  // BP module registry
  // -------------------------------------------------------------------------

  var registry = Object.create(null);
  var cache = Object.create(null);
  var loading = Object.create(null);

  function scriptUrlForRemote(name) {
    if (name.indexOf("dimui/") === 0) {
      // "dimui/theme" → theme.js
      // "dimui/components/atoms/button" → components/atoms/button.js
      var uiPath = name.slice("dimui/".length);
      if (!uiPath) return null;
      return DIMUI_SRC + uiPath + ".js";
    }
    if (name.indexOf("dimurl/") === 0) {
      var urlPath = name.slice("dimurl/".length);
      if (!urlPath) return null;
      return DIMURL_SRC + urlPath + ".js";
    }
    return null;
  }

  function loadScript(url) {
    if (loading[url]) return loading[url];
    loading[url] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url;
      s.async = false;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        delete loading[url];
        reject(new Error("Failed to load script " + url));
      };
      (document.head || document.documentElement).appendChild(s);
    });
    return loading[url];
  }

  function ensureRegistered(name) {
    if (registry[name]) return Promise.resolve();
    var url = scriptUrlForRemote(name);
    if (!url) {
      return Promise.reject(
        new Error('BP module "' + name + '" is not registered'),
      );
    }
    return loadScript(url).then(function () {
      if (!registry[name]) {
        throw new Error(
          'Script loaded for "' +
            name +
            '" from ' +
            url +
            " but BP.module was not called",
        );
      }
    });
  }

  function resolve(name) {
    if (cache[name]) return cache[name];

    cache[name] = ensureRegistered(name)
      .then(function () {
        var entry = registry[name];
        return Promise.all(
          entry.deps.map(function (dep) {
            return resolve(dep);
          }),
        ).then(function (args) {
          return entry.factory.apply(null, args);
        });
      })
      .catch(function (err) {
        delete cache[name];
        throw err;
      });

    return cache[name];
  }

  globalThis.BP = {
    /**
     * Register a classic-script module.
     * @param {string} name
     * @param {string[]} deps
     * @param {(...exports: any) => any} factory
     */
    module: function (name, deps, factory) {
      if (typeof deps === "function") {
        factory = deps;
        deps = [];
      }
      registry[name] = { deps: deps || [], factory: factory };
      // Invalidate a prior resolve so late registration still works if
      // something required the name before its script ran (shouldn't happen
      // with the script order in index.html, but keep the door open).
      delete cache[name];
    },

    /** @param {string} name @returns {Promise<any>} */
    require: function (name) {
      return resolve(name);
    },

    /** @param {string} name @returns {boolean} */
    has: function (name) {
      return Boolean(registry[name]);
    },
  };
})();
