// ==UserScript==
// @name         System Font Replacer
// @namespace    http://tampermonkey.net/
// @version      0.3.3
// @description  Replaces target fonts with system fonts using the @font-face redirection hack
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

(function() {
    'use strict';

    const targetFonts = [
        'app-sans',
        'Costco Sans',
        'Costco Sans Web',
        'Google Sans',
        'Google Sans Flex',
        'Montserrat',
        'Montserrat Thin',
        'Noto Sans',
        'Open Sans',
        'Proxima Nova',
        'Roboto',
        'sans',
        'Segoe UI',
        'VCNudge',
        'Yahoo Sans',
        'YahooSans VF',
        'YahooSans',
        'YTSans',
        'YouTube Sans'
    ];

    const src = "local('System-ui'),local('-apple-system'),local('sans-serif'),local('Helvetica Neue'),local('Arial')";
    const css = targetFonts.map(f =>
        `@font-face{font-family:'${f}';src:${src};font-weight:100 900;font-style:normal}` +
        `@font-face{font-family:'${f}';src:${src};font-weight:100 900;font-style:italic}`
    ).join('');

    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(css);
    } else {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }
})();