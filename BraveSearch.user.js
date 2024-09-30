// ==UserScript==
// @name         NewsRedirector
// @namespace    http://tampermonkey.net/
// @downloadURL  https://raw.githubusercontent.com/pkrayzy/Krayzylist/main/BraveSearch.user.js
// @updateURL    https://raw.githubusercontent.com/pkrayzy/Krayzylist/main/BraveSearch.user.js
// @version      0.1
// @description  Redirect DuckDuckGo Searches to Brave
// @author       You
// @match        https://duckduckgo.com/?q=*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
        window.location.replace( 'https://search.brave.com' + window.location.search);
})();
