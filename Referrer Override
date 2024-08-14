// ==UserScript==
// @name         Referrer Override
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Override the referrer header
// @author       Your Name
// @match        *://www.bloomberg.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    Object.defineProperty(document, 'referrer', {get: function() { return 'https://www.google.com/'; }});
})();
