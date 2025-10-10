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
                    "value": "https://www.duckduckgo.com/"
                }
            ]
        },
        "condition": {
            "urlFilter": "||ft.com/*",
            "resourceTypes": ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "xmlhttprequest", "ping", "media", "websocket", "other"]
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
                    "value": "https://www.duckduckgo.com/"
                }
            ]
        },
        "condition": {
            "urlFilter": "||nytimes.com/*",
            "resourceTypes": ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "xmlhttprequest", "ping", "media", "websocket", "other"]
        }
    }
]