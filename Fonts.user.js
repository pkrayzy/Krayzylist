// ==UserScript==
// @name         System Font Replacer
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Replaces Google Sans and other common fonts with the system font using CSS overrides
// @match        *://*.google.com/*
// @match        *://*.youtube.com/*
// @match        *://*.bing.com/*
// @match        *://*.msn.com/*
// @match        *://*.duckduckgo.com/*
// @match        *://*.search.brave.com/*
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const TARGET_FONTS = [
        'Amazon Ember',
        'Google Sans Flex',
        'Google Sans',
        'Inter Variable',
        'Inter',
        'Noto Sans',
        'Open Sans',
        'Roboto',
        'Segoe UI',
        'Segoe',
        'Tahoma',
        'Verdana',
        'YouTube Sans',
        'YTSans'
    ];

    // Maps every target font to the OS-level system font
    const REPLACEMENT_FONT = "local('System Font')";

    const cssOverrides = TARGET_FONTS.map(font => `
        @font-face {
            font-family: '${font}';
            src: ${REPLACEMENT_FONT};
            font-display: swap;
        }
    `).join('\n');

    GM_addStyle(cssOverrides);
})();
