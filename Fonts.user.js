// ==UserScript==
// @name         System Font Replacer
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Replaces target fonts with system fonts using the @font-face redirection hack
// @updateURL    https://raw.githubusercontent.com/pkrayzy/Krayzylist/main/Fonts.user.js
// @author       You
// @match          *://*.google.com/*
// @match          *://*.youtube.com/*
// @match          *://*.bing.com/*
// @match          *://*.msn.com/*
// @match          *://*.duckduckgo.com/*
// @match          *://*.search.brave.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // The local system fonts we want to map TO
    const SYSTEM_FALLBACKS = "local('SF Pro'), local('-apple-system'), local('BlinkMacSystemFont'), local('Segoe UI'), local('Roboto'), local('Helvetica'), local('Arial')";

    // The fonts we want to replace
    const TARGET_FONTS = [
        'Google Sans',
        'Google Sans Flex',
        'Roboto',
        'Segoe UI',
        'Open Sans',
        'Noto Sans',
        'Inter Variable',
        'Inter'
    ];

    // Generate @font-face rules for each target font
    // This tells the browser: "If you're looking for X, use the system fonts instead"
    const cssRules = TARGET_FONTS.map(font => `
        @font-face {
            font-family: '${font}';
            src: ${SYSTEM_FALLBACKS};
            font-weight: 1 1000; /* Covers all weights */
            font-style: oblique 0deg 10deg; /* Covers all styles */
        }
    `).join('\n');

    GM_addStyle(cssRules);
})();
