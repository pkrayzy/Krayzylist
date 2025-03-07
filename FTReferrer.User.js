// ==UserScript==
// @name         Clear Storage and Set Referrer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Clears local and session storage and sets the referrer to google.com
// @author       Your Name
// @match        *://*.ft.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Clear local storage
    localStorage.clear();

    // Clear session storage
    sessionStorage.clear();

    // Set referrer to google.com
    document.referrer = "https://www.google.com";

    // Optionally, you can also clear cookies
    var cookies = document.cookie.split(";");
    for (var i = 0; i < cookies.length; ++i) {
        var myCookie = cookies[i];
        var pos = myCookie.indexOf("=");
        var name = pos > -1 ? myCookie.substr(0, pos) : myCookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
})();