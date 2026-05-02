// ==UserScript==
// @name        News-Referrer
// @description Changes the referrer
// @run-at request
// ==/UserScript==

[
  {
    "id": 201,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        {
          "header": "Cookie",
          "operation": "remove"
        }
      ]
    },
    "condition": {
      "initiatorDomains": ["ft.com", "nytimes.com", "newyorker.com", "theverge.com"],
      "resourceTypes": ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "xmlhttprequest", "other"]
    }
  },
  {
    "id": 202,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        {
          "header": "Referer",
          "operation": "set",
          "value": "https://www.google.com/"
        }
      ]
    },
    "condition": {
      "initiatorDomains": ["ft.com", "nytimes.com", "newyorker.com", "theverge.com"],
      "resourceTypes": ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "xmlhttprequest", "other"]
    }
  },
  {
    "id": 203,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "header": "Set-Cookie",
          "operation": "remove"
        }
      ]
    },
    "condition": {
      "initiatorDomains": ["ft.com", "nytimes.com", "newyorker.com", "theverge.com"],
      "resourceTypes": ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "xmlhttprequest", "other"]
    }
  }
]