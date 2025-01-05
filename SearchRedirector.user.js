// ==UserScript==
// @name         Redirect Bing to Brave
// @description  Redirects Bing searches to Brave Search
// ==/UserScript==

[{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "redirect",
    "redirect": {
      "transform": {
        "host": "search.brave.com",
        "path": "/search",
        "queryTransform": {
          "addOrReplaceParams": [{
            "key": "q",
            "value": "{searchTerms}"
          }]
        }
      }
    }
  },
  "condition": {
    "urlFilter": "*://www.bing.com/search*",
    "resourceTypes": ["main_frame"]
  }
}]
