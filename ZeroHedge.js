// ==UserScript==
// @name         ZeroHedge Paywall Bypass
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Bypass the ZeroHedge paywall by removing the overlay and restoring full article text.
// @author       Your Name
// @match        *://*.zerohedge.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // --- Utility Functions ---

  // Check if the current hostname exactly matches or ends with the given domain.
  const matchDomain = (domain) =>
    window.location.hostname === domain ||
    window.location.hostname.endsWith("." + domain);

  // Remove one or more DOM elements.
  const removeDOMElement = (...elements) => {
    elements.forEach((el) => {
      if (el) el.remove();
    });
  };

  // Decode any HTML entities by leveraging a temporary textarea element.
  const parseHtmlEntities = (encodedString) => {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = encodedString;
    return textarea.value;
  };

  // Decode a UTF-8 string (using escape/decodeURIComponent)
  const decodeUtf8 = (str) => decodeURIComponent(escape(str));

  // --- ZeroHedge Paywall Bypass Functions ---

  // Remove the premium overlay and inject the full article content.
  const bypassZeroHedge = () => {
    if (!matchDomain("zerohedge.com")) return;

    // Look for the overlay element using a class that begins with "PremiumOverlay_container__"
    const paywall = document.querySelector('div[class^="PremiumOverlay_container__"]');
    if (paywall) {
      removeDOMElement(paywall);

      // Get the site’s embedded JSON containing article details.
      const jsonScript = document.querySelector("script#__NEXT_DATA__");
      if (jsonScript) {
        try {
          const data = JSON.parse(jsonScript.innerText);
          const encodedBody = data?.props?.pageProps?.node?.body;
          if (encodedBody) {
            // Skip the first 21 characters then decode and unescape the Base64 string.
            const articleHTML = parseHtmlEntities(decodeUtf8(atob(encodedBody.substring(21))));
            // Find the container that holds the article.
            const articleContainer = document.querySelector('div[class^="NodeContent_mainContent__"]');
            if (articleContainer) {
              articleContainer.innerHTML = "";
              const parser = new DOMParser();
              const doc = parser.parseFromString(`<div>${articleHTML}</div>`, "text/html");
              const newContent = doc.querySelector("div");
              if (newContent) {
                articleContainer.appendChild(newContent);
              }
            }
          }
        } catch (err) {
          console.error("Error parsing embedded JSON:", err);
        }
      }
    }
  };

  // Additional check for any relic leaky paywall CSS or cookie manipulations.
  const removeLeakyPaywallClasses = () => {
    if (document.querySelector('head > link[href*="/leaky-paywall"], script[src*="/leaky-paywall"], div[id^="issuem-leaky-paywall-"]')) {
      const jsCookie = document.querySelector("script#leaky_paywall_cookie_js-js-extra");
      if (jsCookie && jsCookie.text.includes('"post_container":"')) {
        const postSel = jsCookie.text.split('"post_container":"')[1].split('"')[0];
        if (postSel) {
          const post = document.querySelector(postSel);
          if (post) {
            post.removeAttribute("class");
          }
        }
      }
    }
  };

  // --- Initiate Bypass After a Short Delay ---
  window.setTimeout(() => {
    bypassZeroHedge();
    removeLeakyPaywallClasses();
  }, 1000);
})();