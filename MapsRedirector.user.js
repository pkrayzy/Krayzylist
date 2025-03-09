// ==UserScript==
// @name        GoogleRedirector
// @description Redirects Google Maps to Apple Maps
// @run-at request
// ==/UserScript==

[
    {
          "id": 115,
          "priority": 2,
          "action": {
              "type": "redirect",
              "redirect": {
                  "regexSubstitution": "http://maps.apple.com/?q=\\1"
              }
          },
          "condition": {
              "regexFilter": "^https://www.google.com/maps/q=(.*)",
              "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]
          }
    },
    {
          "id": 116,
          "priority": 2,
          "action": {
              "type": "redirect",
              "redirect": {
                  "regexSubstitution": "http://maps.apple.com/?q=\\1"
              }
          },
          "condition": {
              "regexFilter": "^https://www.google.com/maps/place/(.*)",
              "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]
          }
    },
      {
          "id": 117,
          "priority": 2,
          "action": {
              "type": "redirect",
              "redirect": {
                  "regexSubstitution": "http://maps.apple.com/?q=\\1"
              }
          },
          "condition": {
              "regexFilter": "^https://www.google.com/maps/search/(.*)",
              "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]
              }
      },
      {
          "id": 118,
          "priority": 2,
          "action": {
              "type": "redirect",
              "redirect": {
                  "regexSubstitution": "http://maps.apple.com/?q=\\1"
              }
          },
          "condition": {
              "regexFilter": "^https://www.google.com/maps/dir/(.*)",
              "resourceTypes": ["main_frame", "other", "script", "sub_frame", "xmlhttprequest"]
              }
      }
  ]