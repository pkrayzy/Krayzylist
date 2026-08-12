// ==UserScript==
// @name         Redirect Bing to Brave Search
// @namespace    https://peter-safari-redirect.example
// @version      1.0
// @description  Redirect all Bing searches to Brave Search
// @match        https://www.bing.com/*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Extract query parameter "q"
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");

    // Only redirect if a search query exists
    if (q) {
        const braveURL = "https://search.brave.com/search?q=" + encodeURIComponent(q);
        window.location.replace(braveURL);
    }
})();
