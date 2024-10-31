// ==UserScript==
// @name BraveRedirect
// @description Redirect Ecosia to Brave
// @run-at request
// ==/UserScript==

    {
      id: 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          regexSubstitution: "https://search.brave.com/search?q=\\1"
        }
      },
      condition: {
        regexFilter: "https://(www\\.)?duckduckgo\\.com/(.*)",
        resourceTypes: ["main_frame"]
      }
    };
