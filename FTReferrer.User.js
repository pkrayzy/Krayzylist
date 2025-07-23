// ==UserScript==
// @name         FT.com Privacy Sweeper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Clears cookies, localStorage, and sessionStorage on ft.com
// @author       You
// @match        *://*.ft.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Clear cookies
    document.cookie.split(";").forEach(function(c) {
        document.cookie = c.trim().replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // Clear localStorage
    try {
        localStorage.clear();
    } catch (e) {
        console.warn("Could not clear localStorage:", e);
    }

    // Clear sessionStorage
    try {
        sessionStorage.clear();
    } catch (e) {
        console.warn("Could not clear sessionStorage:", e);
    }

    console.log("FT.com storage cleared.");
})();
