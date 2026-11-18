(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("app-chrome styles and helpers", async function () {
    var chrome = await BP.require("chat/lib/app-chrome");
    expect(Boolean(chrome.shellStyles)).toBe(true);
    expect(typeof chrome.currentImpl).toBe("function");
    expect(typeof chrome.buildImplHref).toBe("function");
    expect(typeof chrome.setNavigateImpl).toBe("function");
    expect(typeof chrome.setImpl).toBe("function");
    expect(typeof chrome.dispatchTheme).toBe("function");

    var prev = document.documentElement.dataset.dimRuntime;
    delete document.documentElement.dataset.dimRuntime;
    expect(chrome.currentImpl()).toBe("js");
    document.documentElement.dataset.dimRuntime = "wasm";
    expect(chrome.currentImpl()).toBe("wasm");
    if (prev) {
      document.documentElement.dataset.dimRuntime = prev;
    } else {
      delete document.documentElement.dataset.dimRuntime;
    }

    var heard = null;
    function onTheme(ev) {
      heard = ev.detail.theme;
    }
    window.addEventListener("dimui-theme-change", onTheme);
    chrome.dispatchTheme("light");
    expect(heard).toBe("light");
    expect(localStorage.getItem("dimui-explorer-theme")).toBe("light");
    chrome.dispatchTheme("dark");
    expect(heard).toBe("dark");
    window.removeEventListener("dimui-theme-change", onTheme);

    expect(
      chrome.buildImplHref("wasm", "http://example.test/app").indexOf("impl=wasm"),
    ).toBeGreaterThan(-1);

    var assigned = null;
    chrome.setNavigateImpl(function (href) {
      assigned = String(href);
    });
    chrome.setImpl("wasm");
    expect(assigned.indexOf("impl=wasm")).toBeGreaterThan(-1);

    // Reset to no-op navigator (production wiring lives in app.js).
    chrome.setNavigateImpl(null);
    chrome.setImpl("js");
  });
})();
