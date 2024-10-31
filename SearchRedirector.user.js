// ==UserScript==
// @name BraveRedirect
// @description Redirect Ecosia to Brave
// @run-at request
// ==/UserScript==

{
    id: 1,
    priority: 1,
    action: {
        type: 'redirect',
        redirect: {
            url: 'https://search.brave.com/search?q=$1'
        }
    },
    condition: {
        urlFilter: 'https://duckduckgo.com/?q=*',
        resourceTypes: ['main_frame']
    }
}
