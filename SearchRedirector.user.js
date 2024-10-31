// ==UserScript==
// @name BraveRedirect
// @description Redirect Ecosia to Brave
// @run-at request
// ==/UserScript==

{
    "id": 6,
    "priority": 1,
    "action": {
        "type": "redirect",
        "redirect": {
            "transform": { "scheme": "https", "host": "search.brave.com" }
        }
    },
    "condition": { "urlFilter": "www.ecosia.org", "resourceTypes": ["main_frame"] }
}
