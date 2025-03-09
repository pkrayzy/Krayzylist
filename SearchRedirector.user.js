// ==UserScript==
// @name        BingRedirector
// @description Redirects Bing Maps to Apple Maps
// @run-at request
// ==/UserScript==

[
  {
      "id": 113,
      "priority": 1,
      "action": {
          "type": "redirect",
          "redirect": {
              "regexSubstitution": "http://maps.apple.com/?q=\\1"
          }
      },
      "condition": {
          "regexFilter": "^https://www.bing.com/maps(?:.*pos.)(?:.*__)(.*)(?:__)",
          "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]
      }
  },
  {
      "id": 114,
      "priority": 1,
      "action": {
          "type": "redirect",
          "redirect": {
              "regexSubstitution": "http://maps.apple.com/?q=\\1"
          }
      },
      "condition": {
          "regexFilter": "^https://www.bing.com/maps(?:.*q=)(.*)",
          "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]
        }
  }
]