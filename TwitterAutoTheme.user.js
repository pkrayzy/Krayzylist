// ==UserScript==
// @name         Twitter Auto Theme
// @version      0.2
// @description  Automatically switches between light and dark themes on Twitter.com (web version) based on system settings. Based on https://greasyfork.org/en/scripts/452575-twitter-auto-theme/code
// @author       13xforever
// @match        https://twitter.com/*
// @run-at       document-start
// @license MIT
// ==/UserScript==

(function() {
    "use strict";
    if (!window.matchMedia) {
        return;
    }

    const LIGHT = "0";
    const DIM = "1";
    const DARK = "2";
    function checkMode(q) {
        let currentNightMode = document.cookie.split(";").find(cookie => cookie.includes("night_mode")).split("=")[1];
        let newNightMode = q.matches ? DARK : LIGHT;
        if (newNightMode !== currentNightMode) {
            const MAX_AGE = 365 * 24 * 60 * 60;
            document.cookie = `night_mode=${newNightMode}; domain=.twitter.com; secure; max-age=${MAX_AGE}`;
        }
    }

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    checkMode(query);
    query.addEventListener('change', checkMode);
})();
