// ==UserScript==
// @name         Redirect Bing Searches to Brave Search
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Redirects Bing search queries to Brave Search
// @author       Your Name
// @match        *://www.bing.com/search?*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Get the search query from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    if (query) {
        // Redirect to Brave Search with the same query
        window.location.href = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
    }
})();
