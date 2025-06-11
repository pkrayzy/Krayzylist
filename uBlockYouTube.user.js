// ==UserScript==
// @name         YouTube
// @namespace    http://tampermonkey.net/
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

    /* ─────────── UTILITY FUNCTIONS ─────────── */

    // Deeply remove keys related to ads from any object.
    function removeAdProps(obj) {
        if (obj && typeof obj === 'object') {
            // These keys are removed whether on a top-level object or nested.
            const keysToRemove = ['adPlacements', 'playerAds', 'adSlots'];
            for (const key in obj) {
                if (keysToRemove.includes(key)) {
                    delete obj[key];
                } else {
                    removeAdProps(obj[key]);
                }
            }
        }
    }

    // Create or override a property using Object.defineProperty so that it always reads as constant.
    function setConstant(fullProp, value) {
        const parts = fullProp.split('.');
        let obj = window;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!(parts[i] in obj)) {
                Object.defineProperty(obj, parts[i], { configurable: true, enumerable: true, value: {} });
            }
            obj = obj[parts[i]];
        }
        Object.defineProperty(obj, parts[parts.length - 1], {
            configurable: false,
            enumerable: true,
            get() { return value; },
            set() {}
        });
    }

    /* ─────────── SET-CONSTANT SCRIPTLETS ─────────── */
    // These mimic:
    // • set-constant('ytInitialPlayerResponse.adPlacements', 'undefined')
    // • set-constant('ytInitialPlayerResponse.adSlots', 'undefined')
    // • set-constant('ytInitialPlayerResponse.playerAds', 'undefined')
    // • set-constant('playerResponse.adPlacements', 'undefined')
    setConstant('ytInitialPlayerResponse.adPlacements', undefined);
    setConstant('ytInitialPlayerResponse.adSlots', undefined);
    setConstant('ytInitialPlayerResponse.playerAds', undefined);
    setConstant('playerResponse.adPlacements', undefined);

    /* ─────────── JSON PARSE PATCH ─────────── */
    // This patch will catch JSON.parse calls and remove ad–related keys.
    // It also adjusts data for "/shorts/" pages by filtering out entries flagged as ads.
    const originalJSONParse = JSON.parse;
    JSON.parse = new Proxy(originalJSONParse, {
        apply(target, thisArg, args) {
            let result = Reflect.apply(target, thisArg, args);
            try {
                // Recursively prune any ad keys we know about.
                removeAdProps(result);
                // For Shorts pages, remove any entries whose command indicates an ad.
                if (location.pathname.startsWith("/shorts/") && result && Array.isArray(result.entries)) {
                    result.entries = result.entries.filter(entry =>
                        !entry?.command?.reelWatchEndpoint?.adClientParams?.isAd
                    );
                }
            } catch (e) {
                // swallow errors on purpose
            }
            return result;
        }
    });

    /* ─────────── INTERCEPT XHR RESPONSES ─────────── */
    // These modifications act like the json-prune-xhr-response scriptlets.
    const xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return xhrOpen.apply(this, arguments);
    };

    // When the responseText property is accessed and the URL matches certain YouTube endpoints,
    // attempt to parse and prune out ad properties.
    const xhrRegex = /playlist\?list=|\/player(?!.*(get_drm_license))|watch\?[tv]=|get_watch\?/;
    const originalResponseTextDescriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "responseText");
    Object.defineProperty(XMLHttpRequest.prototype, "responseText", {
        get: function() {
            let original = "";
            if (originalResponseTextDescriptor && originalResponseTextDescriptor.get)
                original = originalResponseTextDescriptor.get.call(this);
            else
                original = this.response;
            if (this._url && xhrRegex.test(this._url)) {
                try {
                    let json = JSON.parse(original);
                    removeAdProps(json);
                    return JSON.stringify(json);
                } catch (e) {
                    return original;
                }
            }
            return original;
        }
    });

    /* ─────────── INTERCEPT FETCH RESPONSES ─────────── */
    // These modifications mimic the json-prune-fetch-response scriptlets.
    const fetchRegex = /playlist\?list=|player\?|watch\?[tv]=|get_watch\?/;
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        let url = "";
        if (typeof input === "string") url = input;
        else if (input instanceof Request) url = input.url;
        return originalFetch(input, init).then(response => {
            if (response && response.clone && url && fetchRegex.test(url)) {
                try {
                    const cloned = response.clone();
                    return cloned.json().then(data => {
                        removeAdProps(data);
                        const modifiedBody = JSON.stringify(data);
                        const newResponse = new Response(modifiedBody, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers,
                        });
                        return newResponse;
                    }).catch(() => response);
                } catch (e) {
                    return response;
                }
            }
            return response;
        });
    };

    /* ─────────── ADJUST SETTIMEOUT ─────────── */
    // This patch mimics the adjust-setTimeout scriptlets by checking if the callback’s source
    // code (via toString()) contains “[native code]” and if the delay is 17000; if so, it changes the delay.
    (function() {
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = function(callback, delay, ...args) {
            try {
                if (typeof callback === 'function' &&
                    callback.toString().includes('[native code]') &&
                    delay === 17000)
                {
                    delay = 0.001;
                }
            } catch (e) {}
            return originalSetTimeout(callback, delay, ...args);
        };
    })();

    /* ─────────── HANDLE SSAP ENTITY ID EVENTS ─────────── */
    // This block implements the inline code that proxies Array.prototype.push.
    // It intercepts objects with a “ssap” namespace and (if the experiment flag is enabled)
    // records events so that—on DOMContentLoaded—the video time is adjusted if needed.
    (function() {
        let currentURL = document.location.href,
            ssapEvents = [],
            ssapIds = [],
            previousIds = "",
            ssapTriggered = false;
        const originalPush = Array.prototype.push;
        Array.prototype.push = new Proxy(Array.prototype.push, {
            apply(target, thisArg, args) {
                if (
                    window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id &&
                    args[0] && args[0] !== window &&
                    typeof args[0].start === 'number' &&
                    args[0].end &&
                    args[0].namespace === 'ssap' &&
                    args[0].id
                ) {
                    if (!ssapTriggered && args[0].start === 0 && !ssapIds.includes(args[0].id)) {
                        ssapEvents.length = 0;
                        ssapIds.length = 0;
                        ssapTriggered = true;
                        originalPush.call(ssapEvents, args[0]);
                        originalPush.call(ssapIds, args[0].id);
                    } else if (ssapTriggered && args[0].start !== 0 && !ssapIds.includes(args[0].id)) {
                        originalPush.call(ssapEvents, args[0]);
                        originalPush.call(ssapIds, args[0].id);
                    }
                }
                return Reflect.apply(target, thisArg, args);
            }
        });

        document.addEventListener("DOMContentLoaded", function() {
            if (!(window.yt && window.yt.config_ && window.yt.config_.EXPERIMENT_FLAGS &&
                  window.yt.config_.EXPERIMENT_FLAGS.html5_enable_ssap_entity_id))
                return;
            const checkVideo = () => {
                const video = document.querySelector("video");
                if (video && ssapEvents.length) {
                    const duration = Math.round(video.duration);
                    const lastEnd = Math.round(ssapEvents.at(-1).end / 1000);
                    const joinedIds = ssapIds.join(",");
                    if (!video.loop && previousIds !== joinedIds && duration && duration === lastEnd) {
                        const startSec = ssapEvents.at(-1).start / 1000;
                        if (video.currentTime < startSec) {
                            video.currentTime = startSec;
                            ssapTriggered = false;
                            previousIds = joinedIds;
                        }
                    } else if (video.loop && duration && duration === lastEnd) {
                        const startSec = ssapEvents.at(-1).start / 1000;
                        if (video.currentTime < startSec) {
                            video.currentTime = startSec;
                            ssapTriggered = false;
                            previousIds = joinedIds;
                        }
                    }
                }
            };
            checkVideo();
            new MutationObserver(() => {
                if (currentURL !== document.location.href) {
                    currentURL = document.location.href;
                    ssapEvents.length = 0;
                    ssapIds.length = 0;
                    ssapTriggered = false;
                }
                checkVideo();
            }).observe(document, { childList: true, subtree: true });
        });
    })();

})(); 
