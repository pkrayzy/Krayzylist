// ==UserScript==
// @name        NewsReferrer
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
                    "header": "Referer",
                    "operation": "set",
                    "value": "https://www.google.com/"
                }
            ]
        },
        "condition": {
            "urlFilter": "||ft.com/content/*",
            "resourceTypes": ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "xmlhttprequest", "ping", "media", "websocket", "other"]
        }
    }
]