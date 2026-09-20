// ==UserScript==
// @name         System Font Replacer
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Replaces target fonts with system fonts using the @font-face redirection hack
// @updateURL    https://raw.githubusercontent.com/pkrayzy/Krayzylist/main/Fonts.user.js
// @match        *://*.google.com/*
// @match        *://*.youtube.com/*
// @match        *://*.bing.com/*
// @match        *://*.msn.com/*
// @match        *://*.duckduckgo.com/*
// @match        *://*.search.brave.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const targetFonts = [
        'Google Sans',
        'Google Sans Flex',
        'Roboto',
        'Segoe UI',
        'Open Sans',
        'Noto Sans',
        'Inter Variable',
        'Inter'
    ];

    // We create a @font-face rule for every target font.
    // This tells the browser: "Whenever you see [Target Font], use 'SF Pro Display' instead."
    let css = '';
    targetFonts.forEach(font => {
        css += `
            @font-face {
                font-family: '${font}';
                src: local('SF Pro Display'), local('Arial');
                font-weight: 100 900;
                font-style: normal;
            }
            @font-face {
                font-family: '${font}';
                src: local('SF Pro Display'), local('Arial');
                font-weight: 100 900;
                font-style: italic;
            }
        `;
    });

    // Inject the CSS into the page
    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(css);
    } else {
        const style = document.createElement('style');
        style.textContent = css;
        document.documentElement.appendChild(style);
    }
})();
