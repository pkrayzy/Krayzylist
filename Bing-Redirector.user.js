// ==UserScript==
// @name        Bing-Redirector
// @run-at request
// ==/UserScript==
[
  
  {
    "id": 601,
    "priority": 1,
    "action": {
      "type": "redirect",
      "redirect": {
        "regexSubstitution": "https://search.brave.com/search?q=\\1"
      }
    },
    "condition": {
      "regexFilter": "https?://(?:www\\.)?bing\\.com/search\\?.*q=([^&]+)",
      "resourceTypes": ["main_frame"]
    }
  }
]
