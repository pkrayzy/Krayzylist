// ==UserScript==
// @name         System Font Replacer
// @namespace    http://tampermonkey.net/
// @version      0.3.5
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
    
    // Optimization: Use a loop to build the string to avoid intermediate array allocation
    let css = '';
    for (let i = 0; i < targetFonts.length; i++) {
        const f = targetFonts[i];
        css += `@font-face{font-family:'${f}';src:${src};font-weight:400 900;font-style:normal}` +
               `@font-face{font-family:'${f}';src:${src};font-weight:400 900;font-style:italic}`;
    }

    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(css);
    } else {
        const style = document.createElement('style');
        style.textContent = css;
        // document.head is often null at document-start; document.documentElement is always available
        (document.head || document.documentElement).appendChild(style);
    }
})();