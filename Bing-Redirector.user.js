// ==UserScript==
// @name        DDG-Redirector
// @run-at request
// ==/UserScript==
[
  {
    "id": 501,
    "priority": 1,
    "action": {
      "type": "redirect",
      "redirect": {
        "regexSubstitution": "https://search.brave.com/?q=+\\1"
      }
    },
    "condition": {
      "regexFilter": "^https://bing.com/\\?(?:.*&)?q=([^&]+)(?:&.*)?$",
      "resourceTypes": [
        "main_frame"
      ]
    }
  }
]
