// ==UserScript==
// @name         NewsRedirector
// @namespace    http://tampermonkey.net/
// @downloadURL  https://raw.githubusercontent.com/pkrayzy/Krayzylist/main/NewsRedirector.js
// @updateURL    https://raw.githubusercontent.com/pkrayzy/Krayzylist/main/NewsRedirector.js
// @version      0.1
// @description  Convert Weblinks into Google News Redirects
// @author       You
// @match        https://www.ft.com/content/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

        var referrer = new URL(document.referrer).hostname;
        var newURL = window.location.host + window.location.pathname + window.location.search;
        var newsURL = btoa(newURL);
        newsURL.slice(0,-1);

    if (referrer == window.location.host) {
        window.location.replace( 'https://news.google.com/rss/articles/CBMiP2h0dHBzOi8v' + newsURL);
    }

})();
