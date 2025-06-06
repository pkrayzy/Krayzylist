// ==UserScript==
// @name         YouTube Ads & Tracking Mitigation
// @namespace    https://github.com/yourname/youtube-userscripts
// @version      1.0
// @description  Disable YouTube ads and prune ad-related data on youtube.com, youtubekids.com, youtube-nocookie.com, and m.youtube.com
// @author       AI Assistant
// @match        *://www.youtube.com/*
// @match        *://youtube.com/*
// @match        *://m.youtube.com/*
// @match        *://youtubekids.com/*
// @match        *://youtube-nocookie.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Helper: Deeply set a constant property on window object
    function setConstant(path, value) {
        const parts = path.split('.');
        let obj = window;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!(parts[i] in obj)) obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        Object.defineProperty(obj, parts[parts.length - 1], {
            configurable: false,
            enumerable: true,
            writable: false,
            value: value
        });
    }

    // 1. Override ad-related player response properties to undefined
    const adProps = [
        'ytInitialPlayerResponse.adPlacements',
        'ytInitialPlayerResponse.adSlots',
        'ytInitialPlayerResponse.playerAds',
        'playerResponse.adPlacements',
        'playerResponse.adSlots',
        'playerResponse.playerAds',
        'adPlacements',
        'adSlots',
        'playerAds'
    ];

    adProps.forEach(prop => {
        try {
            setConstant(prop, undefined);
        } catch(e) {
            // Ignore if property doesn't exist yet or can't be set
        }
    });

    // 2. Prune ad-related fields from JSON responses (fetch and XHR)
    // Utility to prune keys from JSON object recursively
    function pruneAdFields(obj, keysToRemove) {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => pruneAdFields(item, keysToRemove));
        }
        const newObj = {};
        for (const key in obj) {
            if (keysToRemove.includes(key)) continue;
            newObj[key] = pruneAdFields(obj[key], keysToRemove);
        }
        return newObj;
    }

    const AD_KEYS = ['adPlacements', 'playerAds', 'adSlots', 'playerResponse.adPlacements', 'playerResponse.playerAds', 'playerResponse.adSlots'];

    // Patch fetch to prune ad fields from JSON responses
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(async response => {
            try {
                const url = response.url || '';
                // Only prune on YouTube player-related URLs
                if (/\/playlist\?list=|player\?|watch\?[tv]=|get_watch\?/.test(url)) {
                    const clone = response.clone();
                    const contentType = clone.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const json = await clone.json();
                        const pruned = pruneAdFields(json, AD_KEYS);
                        // Create a new Response with pruned JSON
                        const blob = new Blob([JSON.stringify(pruned)], {type: 'application/json'});
                        return new Response(blob, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    }
                }
            } catch(e) {
                // Fail silently and return original response
            }
            return response;
        });
    };

    // Patch XMLHttpRequest to prune ad fields from JSON responses
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._url = url;
        return originalOpen.call(this, method, url, ...rest);
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        this.addEventListener('readystatechange', function() {
            if (this.readyState === 4) {
                try {
                    if (this._url && /\/playlist\?list=|\/player(?!.*(get_drm_license))|watch\?[tv]=|get_watch\?/.test(this._url)) {
                        const contentType = this.getResponseHeader('content-type') || '';
                        if (contentType.includes('application/json')) {
                            let json = JSON.parse(this.responseText);
                            json = pruneAdFields(json, AD_KEYS);
                            Object.defineProperty(this, 'responseText', {value: JSON.stringify(json)});
                            Object.defineProperty(this, 'response', {value: JSON.stringify(json)});
                        }
                    }
                } catch(e) {
                    // ignore errors
                }
            }
        });
        return originalSend.call(this, body);
    };

    // 3. Fix iframe fetch issue on www.youtube.com
    if (location.hostname === 'www.youtube.com') {
        const appendChildHandler = {
            apply(target, thisArg, args) {
                const result = Reflect.apply(target, thisArg, args);
                try {
                    if (result instanceof HTMLIFrameElement && result.src === 'about:blank' && result.contentWindow) {
                        result.contentWindow.fetch = window.fetch;
                        result.contentWindow.Request = window.Request;
                    }
                } catch(e) {}
                return result;
            }
        };
        Node.prototype.appendChild = new Proxy(Node.prototype.appendChild, appendChildHandler);
    }

    // 4. Patch Promise.then to block "onAbnormalityDetected" callback
    if (location.hostname === 'www.youtube.com') {
        const promiseThenHandler = {
            apply(target, thisArg, args) {
                if (typeof args[0] === 'function' && args[0].toString().includes('onAbnormalityDetected')) {
                    args[0] = function() {}; // replace with empty function
                }
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.Promise.prototype.then = new Proxy(window.Promise.prototype.then, promiseThenHandler);
    }

    // 5. Adjust setTimeout on www.youtube.com
    if (location.hostname === 'www.youtube.com') {
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = function(callback, delay, ...args) {
            if (typeof callback === 'function' && delay === 17000) {
                delay = 0.001;
            }
            return originalSetTimeout(callback, delay, ...args);
        };
    }

    // 6. Handle SSAP entity ID experiment on www.youtube.com
    if (location.hostname === 'www.youtube.com') {
        let currentUrl = document.location.href;
        let e = [], n = [], o = "", r = false;
        const pushProxyHandler = {
            apply(target, thisArg, args) {
                if (window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id && args[0] && args[0] !== window && typeof args[0].start === 'number' && args[0].end && args[0].namespace === 'ssap' && args[0].id) {
                    if (!r || args[0].start !== 0 || n.includes(args[0].id)) {
                        e.length = 0;
                        n.length = 0;
                        r = true;
                        e.push(args[0]);
                        n.push(args[0].id);
                    }
                    if (r && args[0].start !== 0 && !n.includes(args[0].id)) {
                        e.push(args[0]);
                        n.push(args[0].id);
                    }
                }
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.Array.prototype.push = new Proxy(window.Array.prototype.push, pushProxyHandler);

        function checkVideo() {
            const video = document.querySelector('video');
            if (video && e.length) {
                const duration = Math.round(video.duration);
                const lastEnd = Math.round(e.at(-1).end / 1000);
                const ids = n.join(',');
                if (video.loop === false && o !== ids && duration && duration === lastEnd) {
                    const start = e.at(-1).start / 1000;
                    if (video.currentTime < start) {
                        video.currentTime = start;
                        r = false;
                        o = ids;
                    }
                } else if (video.loop === true && duration && duration === lastEnd) {
                    const start = e.at(-1).start / 1000;
                    if (video.currentTime < start) {
                        video.currentTime = start;
                        r = false;
                        o = ids;
                    }
                }
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            if (!window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id) return;
            checkVideo();
            new MutationObserver(() => {
                if (currentUrl !== document.location.href) {
                    currentUrl = document.location.href;
                    e.length = 0;
                    n.length = 0;
                    r = false;
                }
                checkVideo();
            }).observe(document, {childList: true, subtree: true});
        });
    }

    // 7. Filter ads from YouTube Shorts JSON parse
    if (location.hostname === 'www.youtube.com') {
        const originalJSONParse = JSON.parse;
        JSON.parse = new Proxy(originalJSONParse, {
            apply(target, thisArg, args) {
                const parsed = Reflect.apply(target, thisArg, args);
                if (!location.pathname.startsWith('/shorts/')) return parsed;
                if (parsed?.entries && Array.isArray(parsed.entries)) {
                    parsed.entries = parsed.entries.filter(entry => {
                        return !(entry?.command?.reelWatchEndpoint?.adClientParams?.isAd);
                    });
                }
                return parsed;
            }
        });
    }

})();
