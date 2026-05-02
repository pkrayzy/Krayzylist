// ==UserScript==
// @name        Maps-Redirector
// @description Redirects to Apple Maps
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
      "resourceTypes": [
        "main_frame",
        "other",
        "script",
        "sub_frame",
        "xmlhttprequest"
      ]
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
      "resourceTypes": [
        "main_frame",
        "other",
        "script",
        "sub_frame",
        "xmlhttprequest"
      ]
    }
  },
  {
    "id": 115,
    "priority": 1,
    "action": {
      "type": "redirect",
      "redirect": {
        "transform": {
          "host": "maps.apple.com",
          "queryTransform": {
            "addOrReplaceParams": [{ "key": "daddr", "value": "\\1" }]
          }
        },
        "regexSubstitution": "http://maps.apple.com/?daddr=\\1"
      }
    },
    "condition": {
      "regexFilter": "^https?://www\\.google\\.com/maps/dir//([^/]+)",
      "resourceTypes": ["main_frame"]
    }
  },
  {
    "id": 116,
    "priority": 1,
    "action": {
      "type": "redirect",
      "redirect": {
        "regexSubstitution": "http://maps.apple.com/?address=\\1"
      }
    },
    "condition": {
      "regexFilter": "^https?://www\\.google\\.com/maps/place/([^/]+)",
      "resourceTypes": ["main_frame"]
    }
  }
]