// ==UserScript==
// @name         Redirect Bing to Brave Search
// @namespace    https://peter-safari-redirect.example
// @version      1.0
// @description  Redirect all Bing searches to Brave Search
// @match        https://www.bing.com/*
// @run-at       document-start
// ==/UserScript==

(function () {
  const host = location.hostname;
  const path = location.pathname;

  if (host === "www.bing.com" && path === "/search") {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");

    if (q) {
      const braveUrl =
        "https://search.brave.com/search?q=" + encodeURIComponent(q);

      // Avoid infinite loops: only redirect if we're actually on Bing
      if (location.href.indexOf("search.brave.com") === -1) {
        location.replace(braveUrl);
      }
    }
  }
})();
