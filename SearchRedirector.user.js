// ==UserScript==
// @name BraveRedirect
// @description Redirect Ecosia to Brave
// @run-at request
// ==/UserScript==

{
    "id": 1,
    "priority": 1,
    "action": {
        "type": "redirect",
        "redirect": {
            "transform": { "scheme": "https", "host": "www.search.brave.com" }
        }
    },
    "condition": { "urlFilter": "||ecosia.org", "resourceTypes": ["main_frame"] }
}
