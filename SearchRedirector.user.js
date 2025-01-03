// ==UserScript==
// @name         Redirect Bing to Brave
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Redirects Bing searches to Brave Search
// @author       Your Name
// @match        *://www.bing.com/search*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Get the search terms from the URL
    const params = new URLSearchParams(window.location.search);
    const searchTerms = params.get('q');

    // If search terms are found, redirect to Brave Search
    if (searchTerms) {
        const redirectUrl = `https://search.brave.com/search?q=${encodeURIComponent(searchTerms)}`;
        window.location.replace(redirectUrl);
    }
})();
