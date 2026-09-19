// ==UserScript==
// @name         System Font Replacer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Replaces Google Sans and Google Sans Flex with a clean system font stack
// @updateURL    https://raw.githubusercontent.com/pkrayzy/Krayzylist/main/Fonts.user.js
// @author       You
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const SYSTEM_FONT_STACK = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Arial', sans-serif";
    const TARGET_FONTS = ['Google Sans', 'Google Sans Flex', 'Roboto', 'Segoe UI', 'Open Sans', 'Noto Sans','TwitterChirp'];

    function shouldReplaceFont(fontFamily) {
        if (!fontFamily) return false;
        return TARGET_FONTS.some(font => fontFamily.includes(font));
    }

    function applyFontReplacement(element) {
        // Check computed style for the font-family
        const computedStyle = window.getComputedStyle(element);
        if (shouldReplaceFont(computedStyle.fontFamily)) {
            element.style.setProperty('font-family', SYSTEM_FONT_STACK, 'important');
        }

        // Also check children
        element.querySelectorAll('*').forEach((el) => {
            const childStyle = window.getComputedStyle(el);
            if (shouldReplaceFont(childStyle.fontFamily)) {
                el.style.setProperty('font-family', SYSTEM_FONT_STACK, 'important');
            }
        });
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        applyFontReplacement(node);
                    }
                });
            }
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Initial run
    window.addEventListener('DOMContentLoaded', () => {
        applyFontReplacement(document.body);
    });
})();