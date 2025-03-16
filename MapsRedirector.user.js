// ==UserScript==
// @name        MapRedirector
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
            "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]        }
    },
    {
    "id": 121,
    "priority": 1,
    "action": {
        "type": "redirect",
        "redirect": {
            "regexSubstitution": "http://maps.apple.com/?q=\\1"
        }
    },
        "condition": {
            "regexFilter": "^https:\/\/www.google.com\/maps\/dir\/.(.*)(?:/data=!)",
            "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]
        }
    },
    {
        "id": 122,
        "priority": 1,
        "action": {
            "type": "redirect",
            "redirect": {
                "regexSubstitution": "http://maps.apple.com/?q=\\1"
            }
        },
        "condition": {
            "regexFilter": "^https:\/\/www.google.com\/maps?(?:.*search&q=)(.*)(?:&source.*)",
            "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]
        }
    },
    {
        "id": 123,
        "priority": 1,
        "action": {
            "type": "redirect",
            "redirect": {
                "regexSubstitution": "http://maps.apple.com/?q=\\1"
            }
        },
        "condition": {
            "regexFilter": "^https:\/\/www.google.com\/maps?(?:.*&daddr=)(.*)",
            "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]
        }
    },
    {
        "id": 124,
        "priority": 1,
        "action": {
            "type": "redirect",
            "redirect": {
                "regexSubstitution": "http://maps.apple.com/?q=\\1"
            }
        },
        "condition": {
            "regexFilter": "^https:\/\/maps.google.com\/maps\/place\/(.*)(?:/data.*)",
            "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]
        }
    }
  ]