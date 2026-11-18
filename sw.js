/**
 * Service worker for dimim.
 *
 * - Precaches the local app shell on install.
 * - Stale-while-revalidate for in-scope GETs.
 * - Proxies ./pwa/cdn/{dim|dimui}/... to the GitHub Pages CDNs so Dim/dimui
 *   stay interceptable under this app's scope (no changes to those repos).
 * - Accepts CACHE_URLS messages so the first visit can harvest whatever
 *   Dim/dimui modules actually loaded.
 */
/* eslint-disable no-restricted-globals */
(function () {
  var CACHE_VERSION = "dimim-v1";
  var CDN_ORIGIN = "https://positive-intentions.github.io";
  var CDN_PREFIXES = {
    dim: CDN_ORIGIN + "/dim/",
    dimui: CDN_ORIGIN + "/dimui/",
  };

  var APP_SHELL = [
    "./",
    "./index.html",
    "./runtime.js",
    "./app.js",
    "./pwa.js",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-192.png",
    "./icons/icon-maskable-512.png",
    "./icons/icon.svg",
    "./screenshots/narrow.png",
    "./screenshots/wide.png",
    "./chat/lib/vault.js",
    "./chat/lib/tokens.js",
    "./chat/lib/theme.js",
    "./chat/lib/mockData/mockData.js",
    "./chat/lib/pairing/pairing.js",
    "./chat/lib/messages/messages.js",
    "./chat/lib/frames/frames.js",
    "./chat/lib/peer/peer.js",
    "./chat/lib/qr-payload.js",
    "./chat/lib/qr-png.js",
    "./chat/lib/app-chrome.js",
    "./chat/lib/share-code.js",
    "./chat/lib/shell/file-transfer.js",
    "./chat/lib/shell/call-session.js",
    "./chat/lib/shell/pairing-actions.js",
    "./chat/lib/shell/frame-handler.js",
    "./chat/components/atoms/button.js",
    "./chat/components/atoms/icon.js",
    "./chat/components/atoms/icon-button.js",
    "./chat/components/atoms/chip.js",
    "./chat/components/atoms/text-field.js",
    "./chat/components/atoms/text-area.js",
    "./chat/components/atoms/avatar.js",
    "./chat/components/atoms/badge.js",
    "./chat/components/atoms/overlay.js",
    "./chat/components/atoms/empty-state.js",
    "./chat/components/atoms/divider.js",
    "./chat/components/atoms/qr-code.js",
    "./chat/components/molecules/confirm-dialog.js",
    "./chat/components/molecules/overflow-menu.js",
    "./chat/components/molecules/message-bubble.js",
    "./chat/components/molecules/composer.js",
    "./chat/components/molecules/chat-header.js",
    "./chat/components/molecules/incoming-call-banner.js",
    "./chat/components/molecules/qr-scanner.js",
    "./chat/components/molecules/share-code-panel.js",
    "./chat/components/molecules/qr-scanner-overlay.js",
    "./chat/components/organisms/unlock-screen.js",
    "./chat/components/organisms/call-screen.js",
    "./chat/components/organisms/pairing-wizard.js",
    "./chat/components/organisms/chat-thread.js",
    "./chat/components/templates/meet-layout.js",
    "./chat/components/organisms/chat-shell.js",
    "./chat/components/pages/meet-app/meet-app.js",
  ];

  function toAbsolute(relative) {
    return new URL(relative, self.registration.scope).href;
  }

  function proxyPathToCdn(pathname) {
    var marker = "pwa/cdn/";
    var idx = pathname.indexOf(marker);
    if (idx === -1) return null;
    var rest = pathname.slice(idx + marker.length);
    var slash = rest.indexOf("/");
    if (slash === -1) return null;
    var repo = rest.slice(0, slash);
    var path = rest.slice(slash + 1);
    var base = CDN_PREFIXES[repo];
    if (!base) return null;
    return base + path;
  }

  function cdnUrlToProxy(cdnUrl) {
    var url;
    try {
      url = new URL(cdnUrl);
    } catch (e) {
      return null;
    }
    if (url.origin !== CDN_ORIGIN) return null;
    var path = url.pathname;
    if (path.indexOf("/dim/") === 0) {
      return toAbsolute("./pwa/cdn/dim/" + path.slice("/dim/".length));
    }
    if (path.indexOf("/dimui/") === 0) {
      return toAbsolute("./pwa/cdn/dimui/" + path.slice("/dimui/".length));
    }
    return null;
  }

  function isAllowedCdn(urlString) {
    return (
      urlString.indexOf(CDN_PREFIXES.dim) === 0 ||
      urlString.indexOf(CDN_PREFIXES.dimui) === 0
    );
  }

  function matchCached(cache, primary, secondary) {
    return cache.match(primary).then(function (hit) {
      if (hit) return hit;
      if (!secondary || secondary === primary) return null;
      return cache.match(secondary);
    });
  }

  function asSameOriginResponse(response) {
    if (!response) return response;
    var headers = new Headers(response.headers);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  }

  function staleWhileRevalidate(fetchRequest, cacheKeys, opts) {
    var keys = cacheKeys || [fetchRequest];
    var primary = keys[0];
    var secondary = keys[1];
    var wrapForProxy = opts && opts.wrapForProxy;

    return caches.open(CACHE_VERSION).then(function (cache) {
      return matchCached(cache, primary, secondary).then(function (cached) {
        var network = fetch(fetchRequest)
          .then(function (response) {
            if (response && response.ok) {
              var toStore = wrapForProxy
                ? asSameOriginResponse(response.clone())
                : response.clone();
              var puts = [cache.put(primary, toStore.clone())];
              if (secondary && secondary !== primary) {
                puts.push(cache.put(secondary, response.clone()));
              }
              if (
                typeof fetchRequest === "object" &&
                fetchRequest.url &&
                fetchRequest.url !==
                  (typeof primary === "string" ? primary : primary.url)
              ) {
                puts.push(cache.put(fetchRequest.url, response.clone()));
              }
              return Promise.all(puts).then(function () {
                return wrapForProxy ? asSameOriginResponse(response) : response;
              });
            }
            return response;
          })
          .catch(function () {
            return null;
          });

        if (cached) {
          network.then(function () {});
          return wrapForProxy && cached.url && cached.url.indexOf(CDN_ORIGIN) === 0
            ? asSameOriginResponse(cached)
            : cached;
        }

        return network.then(function (response) {
          if (response) return response;
          if (
            typeof fetchRequest === "object" &&
            fetchRequest.mode === "navigate"
          ) {
            return cache
              .match(toAbsolute("./index.html"))
              .then(function (page) {
                return page || Response.error();
              });
          }
          return Response.error();
        });
      });
    });
  }

  self.addEventListener("install", function (event) {
    event.waitUntil(
      caches
        .open(CACHE_VERSION)
        .then(function (cache) {
          return cache.addAll(
            APP_SHELL.map(function (path) {
              return toAbsolute(path);
            }),
          );
        })
        .then(function () {
          return self.skipWaiting();
        }),
    );
  });

  self.addEventListener("activate", function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(function (keys) {
          return Promise.all(
            keys.map(function (key) {
              if (key !== CACHE_VERSION) return caches.delete(key);
            }),
          );
        })
        .then(function () {
          return self.clients.claim();
        }),
    );
  });

  self.addEventListener("fetch", function (event) {
    var request = event.request;
    if (request.method !== "GET") return;

    var url = new URL(request.url);
    var scope = self.registration.scope;
    var scopeUrl = new URL(scope);

    if (url.origin !== scopeUrl.origin || url.href.indexOf(scope) !== 0) {
      return;
    }

    var cdnTarget = proxyPathToCdn(url.pathname);
    if (cdnTarget) {
      event.respondWith(
        staleWhileRevalidate(
          new Request(cdnTarget, { mode: "cors" }),
          [request, cdnTarget],
          { wrapForProxy: true },
        ),
      );
      return;
    }

    event.respondWith(staleWhileRevalidate(request, [request]));
  });

  self.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) {
      return;
    }

    event.waitUntil(
      caches.open(CACHE_VERSION).then(function (cache) {
        return Promise.all(
          data.urls.map(function (raw) {
            if (typeof raw !== "string" || !isAllowedCdn(raw)) return null;

            return fetch(raw, { mode: "cors" })
              .then(function (response) {
                if (!response || !response.ok) return;
                var puts = [cache.put(raw, response.clone())];
                var proxyUrl = cdnUrlToProxy(raw);
                if (proxyUrl) {
                  puts.push(
                    cache.put(proxyUrl, asSameOriginResponse(response.clone())),
                  );
                }
                return Promise.all(puts);
              })
              .catch(function () {
                return null;
              });
          }),
        );
      }),
    );
  });
})();
