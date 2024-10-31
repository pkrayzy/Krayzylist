// @name         DDG Redirect to Brave Search
// @namespace    https://github.com/your-username/ddg-brave-search-redirect
// @version      1.0
// @description  Redirect DuckDuckGo searches to Brave Search.
// @author       Your Name
// @match        https://duckduckgo.com/*
// @run-at       request

 declarativeNetRequest({
  id: 1,
  priority: 1,
  action: {
    type: "redirect",
    url: "https://search.brave.com/search"
  },
  condition: {
    urlFilter: "https://duckduckgo.com/*",
    resourceTypes: ["main_frame"]
  }
});
