/**
 * Two-iframe e2e helpers. DimTest.open only keeps one visible preview iframe,
 * so peers are opened as isolated srcdoc frames (unique IDB + localStorage).
 */
(function (global) {
  var peerSeq = 0;
  var openPeers = [];

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function isolationBootstrap(runId, seed) {
    var seedJson = JSON.stringify(seed || {});
    return (
      "(function(){" +
      "var RUN=" +
      JSON.stringify(String(runId || "0")) +
      ";" +
      "var SEED=" +
      seedJson +
      ";" +
      "var LIVE='DimDatabase';" +
      "var PREFIX='__dimim_peer_'+RUN+'_';" +
      "try{" +
      "var origOpen=indexedDB.open.bind(indexedDB);" +
      "indexedDB.open=function(name,version){" +
      "var next=name;" +
      "if(name===LIVE)next=LIVE+'_e2e_'+RUN;" +
      "else if(name&&String(name).indexOf('_e2e_')<0)next=String(name)+'_e2e_'+RUN;" +
      "return origOpen(next,version);" +
      "};" +
      "}catch(e){}" +
      "try{" +
      "var store=window.localStorage;" +
      "var wrap={" +
      "getItem:function(k){return store.getItem(PREFIX+k);}," +
      "setItem:function(k,v){store.setItem(PREFIX+k,v);}," +
      "removeItem:function(k){store.removeItem(PREFIX+k);}," +
      "clear:function(){" +
      "var keys=[];" +
      "for(var i=0;i<store.length;i++){var key=store.key(i);if(key&&key.indexOf(PREFIX)===0)keys.push(key);}" +
      "for(var j=0;j<keys.length;j++)store.removeItem(keys[j]);" +
      "}," +
      "key:function(i){var n=0;for(var i2=0;i2<store.length;i2++){var key=store.key(i2);if(key&&key.indexOf(PREFIX)===0){if(n===i)return key.slice(PREFIX.length);n++;}}return null;}," +
      "get length(){var n=0;for(var i=0;i<store.length;i++){var key=store.key(i);if(key&&key.indexOf(PREFIX)===0)n++;}return n;}" +
      "};" +
      "try{Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return wrap;}});}catch(e2){window.localStorage=wrap;}" +
      "try{var sk;for(sk in SEED){if(Object.prototype.hasOwnProperty.call(SEED,sk)&&SEED[sk]!=null)wrap.setItem(sk,String(SEED[sk]));}}catch(eSeed){}" +
      "}catch(e3){}" +
      "try{if(navigator.serviceWorker){navigator.serviceWorker.register=function(){return Promise.resolve({unregister:function(){return Promise.resolve(true);}});};}}catch(e4){}" +
      "})();"
    );
  }

  function injectIsolation(html, baseHref, runId, seed) {
    var baseTag =
      '<base href="' + String(baseHref).replace(/"/g, "&quot;") + '">';
    var boot = "<script>" + isolationBootstrap(runId, seed) + "<\/script>";
    var inject = baseTag + boot;
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head[^>]*>/i, function (m) {
        return m + inject;
      });
    }
    return (
      "<!DOCTYPE html><html><head>" +
      inject +
      "</head><body>" +
      html +
      "</body></html>"
    );
  }

  function pierceOne(root, selector, depth) {
    if (!root || depth > 20) return null;
    try {
      var el = root.querySelector && root.querySelector(selector);
      if (el) return el;
    } catch (e) {}
    var nodes = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.shadowRoot) {
        var hit = pierceOne(node.shadowRoot, selector, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  }

  function pierceAll(root, selector, depth, out) {
    out = out || [];
    if (!root || depth > 20) return out;
    try {
      var list = root.querySelectorAll ? root.querySelectorAll(selector) : [];
      for (var i = 0; i < list.length; i++) out.push(list[i]);
    } catch (e) {}
    var nodes = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (var j = 0; j < nodes.length; j++) {
      if (nodes[j].shadowRoot) {
        pierceAll(nodes[j].shadowRoot, selector, depth + 1, out);
      }
    }
    return out;
  }

  function deepText(el) {
    if (!el) return "";
    var parts = [];
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        parts.push(node.textContent || "");
        return;
      }
      if (node.shadowRoot) walk(node.shadowRoot);
      var kids = node.childNodes || [];
      for (var i = 0; i < kids.length; i++) walk(kids[i]);
    }
    walk(el);
    return parts.join(" ");
  }

  function makePage(iframe) {
    var closed = false;
    function doc() {
      return (
        iframe.contentDocument ||
        (iframe.contentWindow && iframe.contentWindow.document)
      );
    }
    function ensureOpen() {
      if (closed) throw new Error("peer page closed");
      var d = doc();
      if (!d) throw new Error("peer contentDocument unavailable");
      return d;
    }
    function query(selector) {
      return pierceOne(ensureOpen(), selector, 0);
    }
    function queryAll(selector) {
      return pierceAll(ensureOpen(), selector, 0, []);
    }
    function text(selector) {
      if (selector == null) {
        return deepText(ensureOpen().body || ensureOpen().documentElement);
      }
      var el = typeof selector === "string" ? query(selector) : selector;
      return deepText(el);
    }
    function wait(selectorOrFn, timeoutMs) {
      var timeout = timeoutMs || 30000;
      var start = Date.now();
      function tick() {
        if (closed) return Promise.reject(new Error("peer wait: closed"));
        var value = null;
        try {
          if (typeof selectorOrFn === "function") {
            value = selectorOrFn(doc(), iframe.contentWindow);
          } else {
            value = pierceOne(doc(), String(selectorOrFn || ""), 0);
          }
        } catch (e) {
          value = null;
        }
        if (value) return Promise.resolve(value);
        if (Date.now() - start >= timeout) {
          return Promise.reject(
            new Error(
              "peer wait timeout: " +
                (typeof selectorOrFn === "function"
                  ? "condition"
                  : String(selectorOrFn)),
            ),
          );
        }
        return sleep(50).then(tick);
      }
      return tick();
    }
    function fill(selectorOrEl, value) {
      var el =
        typeof selectorOrEl === "string" ? query(selectorOrEl) : selectorOrEl;
      if (!el) throw new Error("fill: element not found");
      var input =
        (el.shadowRoot &&
          el.shadowRoot.querySelector("input, textarea")) ||
        (el.matches && el.matches("input, textarea") ? el : null) ||
        (el.querySelector && el.querySelector("input, textarea"));
      if (!input) throw new Error("fill: no input");
      var str = value == null ? "" : String(value);
      input.focus && input.focus();
      input.value = str;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return sleep(0).then(function () {
        return new Promise(function (resolve) {
          requestAnimationFrame(function () {
            requestAnimationFrame(resolve);
          });
        });
      });
    }
    function click(selectorOrEl) {
      var el =
        typeof selectorOrEl === "string" ? query(selectorOrEl) : selectorOrEl;
      if (!el) throw new Error("click: element not found");
      var btn =
        (el.shadowRoot && el.shadowRoot.querySelector("button")) || el;
      btn.click();
      return sleep(0);
    }
    function close() {
      if (closed) return;
      closed = true;
      var idx = openPeers.indexOf(page);
      if (idx >= 0) openPeers.splice(idx, 1);
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }
    var page = {
      iframe: iframe,
      query: query,
      queryAll: queryAll,
      text: text,
      wait: wait,
      fill: fill,
      click: click,
      close: close,
    };
    return page;
  }

  function hostRoot() {
    var root = document.getElementById("dimim-peer-host");
    if (!root) {
      root = document.createElement("div");
      root.id = "dimim-peer-host";
      root.style.cssText =
        "position:fixed;inset:0;display:flex;gap:4px;z-index:9998;pointer-events:none;";
      document.body.appendChild(root);
    }
    return root;
  }

  function openPeer(label, opts) {
    opts = opts || {};
    peerSeq += 1;
    var runId =
      String(label || "p") +
      "_" +
      Date.now().toString(36) +
      "_" +
      peerSeq +
      "_" +
      Math.random().toString(36).slice(2, 6);
    var url = opts.url || "./index.html";
    var absolute = new URL(url, location.href);
    var baseHref = absolute.href.replace(/[^/]*$/, "");
    var seed = opts.seed || {};
    try {
      var impl =
        (document.documentElement &&
          document.documentElement.dataset &&
          document.documentElement.dataset.dimRuntime) ||
        "";
      if (impl === "js" || impl === "wasm") seed["dimim-impl"] = impl;
    } catch (e) {}

    var iframe = document.createElement("iframe");
    iframe.setAttribute("title", "dimim peer " + label);
    iframe.setAttribute("data-dimim-peer", label || runId);
    iframe.setAttribute(
      "allow",
      "camera; microphone; display-capture; autoplay",
    );
    iframe.style.cssText =
      "flex:1;min-width:0;height:48vh;border:1px solid #64748b;pointer-events:auto;background:#0f172a;";
    hostRoot().appendChild(iframe);

    return fetch(absolute.href)
      .then(function (res) {
        if (!res.ok) throw new Error("openPeer fetch failed " + res.status);
        return res.text();
      })
      .then(function (html) {
        iframe.srcdoc = injectIsolation(html, baseHref, runId, seed);
        var page = makePage(iframe);
        openPeers.push(page);
        return page
          .wait(opts.ready || "dimim-app", opts.timeout || 60000)
          .then(function () {
            try {
              var w = iframe.contentWindow;
              if (w && w.BP && w.BP.require) {
                return w.BP.require("chat/lib/peer").then(function (peer) {
                  if (peer && peer.setIceWaitMs) peer.setIceWaitMs(1500);
                  if (peer && peer.setIcePreset) peer.setIcePreset("cloudflare");
                  return page;
                });
              }
            } catch (e) {}
            return page;
          });
      });
  }

  function closeAllPeers() {
    while (openPeers.length) {
      openPeers[0].close();
    }
    var host = document.getElementById("dimim-peer-host");
    if (host && host.parentNode) host.parentNode.removeChild(host);
  }

  function readCode(page) {
    return page.wait(function () {
      var el = page.query("[data-invite-code]");
      if (!el) return null;
      var code = el.getAttribute("data-invite-code") || "";
      return code && code.indexOf("wu1:") === 0 ? code : null;
    }, 60000);
  }

  function pasteCode(page, code) {
    return page
      .wait("dimim-share-code-panel", 30000)
      .then(function () {
        var panel = page.query("dimim-share-code-panel");
        var field = panel.shadowRoot.querySelector("dimui-text-field");
        if (!field) {
          var toggle = Array.prototype.find.call(
            panel.shadowRoot.querySelectorAll("dimui-button"),
            function (b) {
              var t = (b.shadowRoot && b.shadowRoot.textContent) || "";
              return (
                t.indexOf("Paste peer code") >= 0 ||
                t.indexOf("Hide paste") >= 0
              );
            },
          );
          if (
            toggle &&
            (toggle.shadowRoot.textContent || "").indexOf("Paste") >= 0
          ) {
            return page.click(toggle).then(function () {
              return page.wait(function () {
                return panel.shadowRoot.querySelector("dimui-text-field");
              }, 5000);
            });
          }
        }
        return field;
      })
      .then(function () {
        var panel = page.query("dimim-share-code-panel");
        var field = panel.shadowRoot.querySelector("dimui-text-field");
        if (!field) throw new Error("pasteCode: paste field missing");
        return page.fill(field, code).then(function () {
          return sleep(50);
        }).then(function () {
          // Ensure controlled value stuck (some Dim renders reset before click)
          var input =
            field.shadowRoot &&
            field.shadowRoot.querySelector("input, textarea");
          if (input && input.value !== code) {
            input.value = code;
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
          var usePaste = Array.prototype.find.call(
            panel.shadowRoot.querySelectorAll("dimui-button"),
            function (b) {
              return (
                ((b.shadowRoot && b.shadowRoot.textContent) || "").indexOf(
                  "Use pasted",
                ) >= 0
              );
            },
          );
          if (!usePaste) throw new Error("pasteCode: Use pasted missing");
          return page.click(usePaste);
        });
      });
  }

  function createVault(page, password) {
    return page.wait("dimim-unlock", 30000).then(function () {
      var fields = page.queryAll("dimui-text-field");
      return page
        .fill(fields[0], password)
        .then(function () {
          if (fields[1]) return page.fill(fields[1], password);
        })
        .then(function () {
          return page.click("dimui-button");
        })
        .then(function () {
          return page.wait("dimim-chat-shell", 30000);
        });
    });
  }

  function completeProfile(page, displayName, handle) {
    return page.wait("dimim-pairing-wizard", 30000).then(function () {
      return page
        .wait(function () {
          var text = page.text("dimim-pairing-wizard") || "";
          return text.indexOf("Set up your profile") >= 0 ? true : null;
        }, 15000)
        .then(function () {
          var fields = page.queryAll("dimui-text-field");
          return page.fill(fields[0], displayName).then(function () {
            return page.fill(fields[1], handle);
          });
        })
        .then(function () {
          var wizard = page.query("dimim-pairing-wizard");
          var btn = wizard.shadowRoot.querySelector("dimui-button");
          return page.click(btn);
        })
        .then(function () {
          return page.wait(function () {
            var text = page.text("dimim-pairing-wizard") || "";
            return text.indexOf("Share your invite") >= 0 ||
              text.indexOf("Share your reply") >= 0
              ? true
              : null;
          }, 30000);
        });
    });
  }

  function sendChat(page, body) {
    return page.wait("dimim-composer", 30000).then(function () {
      var composer = page.query("dimim-composer");
      var ta = composer.shadowRoot.querySelector("textarea");
      ta.value = body;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      var send = composer.shadowRoot.querySelectorAll("dimui-icon-button")[1];
      return page.click(send);
    });
  }

  global.DimimE2E = {
    openPeer: openPeer,
    closeAllPeers: closeAllPeers,
    readCode: readCode,
    pasteCode: pasteCode,
    createVault: createVault,
    completeProfile: completeProfile,
    sendChat: sendChat,
    sleep: sleep,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
