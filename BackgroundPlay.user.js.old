// ==UserScript==
// @name         Youtube Background Play
// @namespace    com.pkrayzy.wblock
// @version      0.1.40
// @description  Enables background playback on YouTube by spoofing page visibility.
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://music.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @match        https://youtube-nocookie.com/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// @updateURL    https://raw.githubusercontent.com/pkrayzy/Krayzylist/main/BackgroundPlay.user.js
// ==/UserScript==

(function () {
    'use strict';

    /**
     * Background Playback Logic
     * 
     * YouTube checks the 'document.hidden' and 'document.visibilityState' 
     * properties to determine if the user has left the page. If they have, 
     * the player is automatically paused.
     * 
     * This function overrides those properties to always return 'visible' 
     * or 'false', preventing the auto-pause behavior.
     */
    function enableBackgroundPlayback() {
        try {
            Object.defineProperty(document, 'hidden', {
                get: function () { return false; },
                configurable: true
            });
        } catch (e) { /* ignore */ }
        
        try {
            Object.defineProperty(document, 'visibilityState', {
                get: function () { return 'visible'; },
                configurable: true
            });
        } catch (e) { /* ignore */ }
        
        try {
            Object.defineProperty(document, 'webkitHidden', {
                get: function () { return false; },
                configurable: true
            });
        } catch (e) { /* ignore */ }
        
        try {
            Object.defineProperty(document, 'webkitVisibilityState', {
                get: function () { return 'visible'; },
                configurable: true
            });
        } catch (e) { /* ignore */ }
    }

    // Initialize immediately at document-start
    enableBackgroundPlayback();

})();
