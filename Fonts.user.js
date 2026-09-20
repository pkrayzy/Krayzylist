// ==UserScript==
// @name         System Font Replacer
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Replaces Google Sans and other common fonts with a clean system font stack using CSS overrides
// @updateURL    https://raw.githubusercontent.com/pkrayzy/Krayzylist/main/Fonts.user.js
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

    // The local font stack we want the browser to use when the target fonts are requested
    const SYSTEM_FONT_STACK = "local('SF Pro'), local('-apple-system'), local('Arial'), sans-serif";
    // const SYSTEM_FONT_STACK = "'SF Pro', -apple-system, 'Arial', sans-serif";

    const cssOverrides = TARGET_FONTS.map(font => `
        @font-face {
            font-family: '${font}';
            src: ${SYSTEM_FONT_STACK};
        }
    `).join('\n');

    GM_addStyle(cssOverrides);
})();
