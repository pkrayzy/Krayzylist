// ==UserScript==
// @name         DuckDuckGoTheme
// @namespace    https://duckduckgo.com/
// @version      1.3
// @description  Sets DuckDuckGo's 'ae' cookie to match the OS light/dark preference with session expiration
// @match        https://duckduckgo.com/*
// @match        https://www.duckduckgo.com/*
// @match        *://*.duckduckgo.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // DuckDuckGo reads the "ae" cookie:
    //   "-1" → force light theme
    //   "d"  → force dark theme
    const COOKIE_NAME = 'ae';
    const LIGHT_VALUE = '-1';
    const DARK_VALUE = 'd';
    const COOKIE_PATH = '/';

    // Helper to set a session cookie (no expiration = browser session)
    function setSessionCookie(name, value) {
        document.cookie = `${name}=${value}; path=${COOKIE_PATH}; SameSite=Lax`;
    }

    // Apply the correct cookie based on the current media query
    function syncTheme(isDark) {
        const desired = isDark ? DARK_VALUE : LIGHT_VALUE;
        // Only update if the cookie differs to avoid unnecessary reloads
        const current = document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_NAME}=`));
        const currentValue = current ? current.split('=')[1] : null;
        if (currentValue !== desired) {
            setSessionCookie(COOKIE_NAME, desired);
            // DuckDuckGo applies the theme on page load, so reload to take effect
            location.reload();
        }
    }

    // Detect system theme
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    // Initial sync
    syncTheme(mq.matches);

    // Listen for changes in the OS theme
    mq.addEventListener('change', e => {
        syncTheme(e.matches);
    });
})();
