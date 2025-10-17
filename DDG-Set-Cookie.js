// ==UserScript==
// @name         DDG-Set-Cookie
// @namespace    https://duckduckgo.com/
// @version      1.0
// @description  Apply the same cookie-setting actions as the provided uBlock-style trusted-set-cookie rules on duckduckgo.com
// @match        *://*.duckduckgo.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // Helper to set a cookie with basic options.
  // name: cookie name
  // value: cookie value (string)
  // options: {path, domain, expires} - expires can be Date or number of days
  function setCookie(name, value, options = {}) {
    let cookie = encodeURIComponent(name) + '=' + encodeURIComponent(String(value));
    if (options.path) cookie += '; path=' + options.path;
    if (options.domain) cookie += '; domain=' + options.domain;
    if (options.expires instanceof Date) {
      cookie += '; expires=' + options.expires.toUTCString();
    } else if (typeof options.expires === 'number') {
      const date = new Date();
      date.setTime(date.getTime() + options.expires * 24 * 60 * 60 * 1000);
      cookie += '; expires=' + date.toUTCString();
    }
    // secure/samesite not set here; add if needed.
    document.cookie = cookie;
  }

  // Map the uBlock trusted-set-cookie parameter to actual cookie values/behavior.
  // uBlock uses: +js(trusted-set-cookie, NAME, VALUE)
  // Interpretations (reasonable assumptions used):
  //  - numeric strings (e.g., "1","-1","3","5","0") => exact string values
  //  - letters preserved as-is (e.g., "u","b","m","n")
  // If the value is "-1" we set the cookie value to "-1".
  // For some keys that look like flags, set a path=/ and session cookie.
  const cookieActions = [
    ['1', '-1'],
    ['5', '1'],
    ['aj', 'u'],
    ['ak', '-1'],
    ['ao', '-1'],
    ['ap', '-1'],
    ['aq', '-1'],
    ['ar', '1'],
    ['au', '-1'],
    ['av', '1'],
    ['ax', '-1'],
    ['ay', 'b'],
    ['bc', '1'],
    ['bi', '1'],
    ['dcm', '3'],
    ['dcs', '0'],
    ['psb', '-1'],
    ['sn', '5'],
    ['v', 'm'],
    ['a', 'u'],
    ['be', '3'],
    ['bj', '1'],
    ['t', 'u']
  ];

  // Set cookies on document-start if possible; otherwise run as soon as DOM is available.
  try {
    // Set a reasonable default: path=/ so cookies are available site-wide.
    cookieActions.forEach(([name, value]) => {
      setCookie(name, value, { path: '/' });
    });
  } catch (e) {
    // If document isn't ready to accept cookies, set on load as fallback.
    window.addEventListener('DOMContentLoaded', function () {
      cookieActions.forEach(([name, value]) => {
        setCookie(name, value, { path: '/' });
      });
    }, { once: true });
  }
})();