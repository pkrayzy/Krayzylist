// ==UserScript==
// @name         System Font Replacer
// @namespace    http://tampermonkey.net/
// @version      0.7
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

    const SYSTEM_STACK = "'SF Pro', 'Arial', sans-serif";

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

    // This creates specific CSS rules for each font.
    // It targets elements where the font name appears in the style attribute.
    const cssRules = TARGET_FONTS.map(font => `
        [style*="${font}"] { 
            font-family: ${SYSTEM_STACK} !important; 
        }
    `).join('\n');

    GM_addStyle(cssRules);
})();
