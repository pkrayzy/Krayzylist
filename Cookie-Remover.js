// ==UserScript==
// @name         Cookie-Remover
// @namespace    https://duck.ai/
// @version      0.1
// @description  Remove cookies and clear localStorage/sessionStorage entries matching patterns on bloomberg.com, ft.com, nytimes.com
// @author       You
// @match        *://*.bloomberg.com/*
// @match        *://bloomberg.com/*
// @match        *://*.ft.com/*
// @match        *://ft.com/*
// @match        *://*.nytimes.com/*
// @match        *://nytimes.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Configuration: patterns to remove.
  // The original rules indicated:
  // - remove-cookie (all cookies)
  // - set-local-storage-item, /*/, $remove$  -> remove all localStorage entries
  // - set-session-storage-item, /*/, $remove$ -> remove all sessionStorage entries
  //
  // We'll:
  // 1) delete all cookies visible to the current document
  // 2) remove all localStorage keys
  // 3) remove all sessionStorage keys
  //
  // Run on page load and also after DOMContentLoaded to catch scripts that run early.

  function removeAllCookies() {
    try {
      const cookies = document.cookie.split(';').map(c => c.trim()).filter(Boolean);
      for (const cookie of cookies) {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        // Delete cookie for current path
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        // Also attempt to delete for other common paths and domain variants
        const host = location.hostname;
        const domainParts = host.split('.');
        for (let i = 0; i < domainParts.length - 1; i++) {
          const domain = '.' + domainParts.slice(i).join('.');
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + domain;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  function clearLocalStorage() {
    try {
      if (window.localStorage) {
        // Remove all keys
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  function clearSessionStorage() {
    try {
      if (window.sessionStorage) {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  function runAll() {
    removeAllCookies();
    clearLocalStorage();
    clearSessionStorage();
  }

  // Run ASAP
  runAll();

  // Also run after DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAll, { once: true });
  } else {
    // run again shortly to catch sites that set items after load
    setTimeout(runAll, 500);
  }

  // Some sites set storage via rapid scripts; observe storage changes and remove new keys
  try {
    const lsObserver = new MutationObserver(() => {
      // nothing in DOM to watch for storage, but periodically purge
      clearLocalStorage();
      clearSessionStorage();
    });
    // Observe head for mutations as heuristic
    lsObserver.observe(document.documentElement || document, { childList: true, subtree: true });
    // Also periodic cleanup
    setInterval(runAll, 2000);
  } catch (e) {
    // ignore
  }

})();