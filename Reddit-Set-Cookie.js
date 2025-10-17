// ==UserScript==
// @name         Reddit-Set-Cookie
// @namespace    https://reddit.com/
// @version      1.0
// @description  Set cookie "theme=0" for reddit.com
// @match        https://www.reddit.com/*
// @match        https://reddit.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Cookie parameters
  const name = 'theme';
  const value = '0';

  // Set cookie for current domain and path root, expires in 1 year
  const days = 365;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;

  // If reddit uses a specific host cookie (e.g., .reddit.com), try setting that too.
  try {
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; domain=reddit.com; path=/; SameSite=Lax`;
  } catch (e) {
    // ignore domain setting failures (cross-site-frame or browser restrictions)
  }
})();
