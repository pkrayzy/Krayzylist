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
    let css = '';
    targetFonts.forEach(font => {
        css += `
            @font-face {
                font-family: '${font}';
                src: local('System-ui'), local('-apple-system'), local('InterVariable'), local('Helvetica Neue'), local('sans-serif');
                font-weight: 100 900;
                font-style: normal;
            }
            @font-face {
                font-family: '${font}';
                src: local('System-ui'), local('-apple-system'), local('InterVariable'), local('Helvetica Neue'), local('sans-serif');
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

    // PERFORMANCE-OPTIMIZED Logic: "if weight < 400, then use 400, else inherit"
    const enforceMinWeight = (el) => {
        if (!el || el.nodeType !== 1) return;
        
        const style = window.getComputedStyle(el);
        const weight = style.fontWeight;
        
        // Rapid check: if it's already 400 or more, skip immediately.
        // Handle both numeric values (e.g. "300") and keywords (e.g. "normal", "bold").
        if (weight === 'normal' || weight === 'bold' || parseInt(weight, 10) >= 400) {
            return;
        }
        
        const numericWeight = parseInt(weight, 10);
        if (!isNaN(numericWeight) && numericWeight < 400) {
            el.style.setProperty('font-weight', '400', 'important');
            el.style.setProperty('font-variation-settings', '"wght" 400', 'important');
        }
    };

    // Use a fast loop for the initial pass
    const initialElements = document.querySelectorAll('*');
    for (let i = 0; i < initialElements.length; i++) {
        enforceMinWeight(initialElements[i]);
    }

    // Use MutationObserver with a filter to minimize calls.
    // We only process elements that are likely to have text or set font weights.
    const observer = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
            const mutation = mutations[i];
            const nodes = mutation.addedNodes;
            for (let j = 0; j < nodes.length; j++) {
                const node = nodes[j];
                if (node.nodeType === 1) {
                    enforceMinWeight(node);
                    // Only recurse if the node has children
                    if (node.children.length > 0) {
                        const children = node.querySelectorAll('*');
                        for (let k = 0; k < children.length; k++) {
                            enforceMinWeight(children[k]);
                        }
                    }
                }
            }
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
