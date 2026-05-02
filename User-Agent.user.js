// ==UserScript==
// @name        User Agent
// @description Changes the referrer
// @run-at request
// ==/UserScript==
[
  {
    "id": 301,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        {
          "header": "user-agent",
          "operation": "set",
          "value": "Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1"
        }
      ]
    },
    "condition": {
      "urlFilter": "||news.google.com",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "xmlhttprequest",
        "script",
        "image",
        "stylesheet"
      ]
    }
  }
]