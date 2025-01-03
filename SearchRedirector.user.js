// ==/UserScript==
// @name         DDG Redirect to Brave Search
// @description  Redirect DuckDuckGo searches to Brave Search.
// @run-at       request
// ==/UserScript==

{
  id: 22891,
  priority: 1,
  action: {
    type: "redirect",
    redirect: {
      regexSubstitution: "https://search.brave.com/search?q=\\1"
    }
  },
  condition: {
    regexFilter: "https://www.bing.com/search?q\\?(?:.*&)?q=([^&]*).*",
    resourceTypes: ["main_frame"]
  }
}
