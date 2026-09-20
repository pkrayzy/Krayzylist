// ==UserScript==
// @name         System Font Replacer
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  Replaces specific target fonts with the native system font stack
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

    // The system font stack that works across Windows, Mac, and Linux
    const SYSTEM_STACK = "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif";

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

    // We create a CSS rule that targets any element using these fonts 
    // and forces them to use the system stack.
    const cssRules = TARGET_FONTS.map(font => `
        [style*="${font}"], 
        .font-${font.replace(/\s+/g, '-').toLowerCase()} { 
            font-family: ${SYSTEM_STACK} !important; 
        }
    `).join('\n');

    GM_addStyle(cssRules + globalOverride);
})();
