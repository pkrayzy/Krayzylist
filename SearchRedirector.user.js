// @name         DDG Redirect to Brave Search
// @description  Redirect DuckDuckGo searches to Brave Search.

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
