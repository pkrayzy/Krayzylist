// ==UserScript==
// @name         System Font Replacer
// @namespace    http://tampermonkey.net/
// @version      0.3.1
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
        'Segoe UI',
        'Yahoo Sans',
        'YahooSans VF',
        'YahooSans',
        'YTSans',
        'YouTube Sans'
    ];

    // We create a @font-face rule for every target font.
    // This tells the browser: "Whenever you see [Target Font], use 'SF Pro Display' instead."
    // src: local('.AppleSystemUIFont'), local('SF Pro'), local('SF Pro Text'), local('SF Pro Display'), local('Helvetica'), local('Arial'), local('Sans-Serif');
    let css = '';
    targetFonts.forEach(font => {
        css += `
            @font-face {
                font-family: '${font}';
                src: local('Helvetica Neue');
                font-weight: 100 900;
                font-style: normal;
            }
            @font-face {
                font-family: '${font}';
                src: local('Helvetica Neue');
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

    // JS Logic: "if weight < 400, then use 400, else inherit"
    const enforceMinWeight = (el) => {
        if (el.nodeType !== 1) return; // Only process elements
        const weight = window.getComputedStyle(el).fontWeight;
        const numericWeight = parseInt(weight, 10);
        
        if (!isNaN(numericWeight) && numericWeight < 400) {
            el.style.setProperty('font-weight', '400', 'important');
        }
    };

    // Observe the document for new elements to handle dynamic content
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    enforceMinWeight(node);
                    node.querySelectorAll('*').forEach(enforceMinWeight);
                }
            });
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Initial pass for existing elements
    document.querySelectorAll('*').forEach(enforceMinWeight);
})();
