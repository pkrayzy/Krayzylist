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
        "transform": {
          "scheme": "https",
          "host": "search.brave.com",
          "path": "/search",
          "queryTransform": {
            "addOrReplaceParams": [
              { "key": "q", "value": "{{urlParam:q}}" }
            ]
          }
        }
      }
    },
    "condition": {
      "urlFilter": "bing.com/search",
      "resourceTypes": ["main_frame"]
    }
  }
]
