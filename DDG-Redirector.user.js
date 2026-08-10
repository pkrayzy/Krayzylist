// ==UserScript==
// @name        DDG-Redirector
// @run-at request
// ==/UserScript==
[
  {
    "id": 401,
    "priority": 1,
    "action": {
      "type": "redirect",
      "redirect": {
        "regexSubstitution": "https://duckduckgo.com/?q=!brave+\\1"
      }
    },
    "condition": {
      "regexFilter": "^https://duckduckgo.com/\\?q=(.*)",
      "resourceTypes": ["main_frame"]
    }
  }
]