// ==UserScript==
// @name         DuckDuckGo Theme-Based Cookie Setter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Set cookies based on system theme for DuckDuckGo
// @match        *://*.duckduckgo.com/*
// @match        https://www.duckduckgo.com/*
// @match        https://duckduckgo.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Cookie parameters
    const name = 'ae';
    const dark = 'd';
    const light = '-1';

    function isDarkTheme() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDarkTheme()) {
        // Set cookie for current domain and path root, expires in 1 year
        const days = 365;
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(dark)}; expires=${expires}; path=/; SameSite=Lax`;

        // If reddit uses a specific host cookie (e.g., .reddit.com), try setting that too.
        try {
            document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(dark)}; expires=${expires}; domain=.reddit.com; path=/; SameSite=Lax`;
        } catch (e) {
            // ignore domain setting failures (cross-site-frame or browser restrictions)
        }
    }

    else {  // Set cookie for current domain and path root, expires in 1 year
        const days = 365;
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(light)}; expires=${expires}; path=/; SameSite=Lax`;

        // If reddit uses a specific host cookie (e.g., .reddit.com), try setting that too.
        try {
            document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(light)}; expires=${expires}; domain=.reddit.com; path=/; SameSite=Lax`;
        } catch (e) {
            // ignore domain setting failures (cross-site-frame or browser restrictions)
        }
    }

})();