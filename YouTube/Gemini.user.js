// ==UserScript==
// @name         YouTube Ad and Annoyance Blocker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Blocks ads on YouTube, YouTube Kids, and YouTube NoCookie by modifying player responses and pruning ad-related data.
// @author       Your Name
// @match        *://*.youtubekids.com/*
// @match        *://*.youtube-nocookie.com/*
// @match        *://*.youtube.com/*
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const logPrefix = '[YT Ad Blocker]';

    // Helper function to safely set properties on potentially undefined objects
    const setDeepValue = (obj, path, value) => {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (current[keys[i]] === undefined) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
    };

    // Helper function to prune keys from a JSON object
    const pruneJson = (obj, keysToPrune) => {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => pruneJson(item, keysToPrune));
        }

        const newObj = {};
        for (const key in obj) {
            if (!keysToPrune.includes(key)) {
                newObj[key] = pruneJson(obj[key], keysToPrune);
            }
        }
        return newObj;
    };

    // --- Rule Implementations ---

    // Rule: set-constant for various ad-related properties
    const constantsToUndefined = [
        'ytInitialPlayerResponse.adPlacements',
        'ytInitialPlayerResponse.adSlots',
        'ytInitialPlayerResponse.playerAds',
        'playerResponse.adPlacements'
    ];
    constantsToUndefined.forEach(path => {
        try {
            setDeepValue(unsafeWindow, path, undefined);
        } catch (e) {
            // This might fail if the object doesn't exist yet, which is fine.
        }
    });

    // Rule: json-prune and json-prune-xhr/fetch-response
    const keysToPrune = [
        'adPlacements',
        'playerAds',
        'adSlots',
        'reelWatchEndpoint.adClientParams.isAd' // for shorts
    ];

    const originalJsonParse = JSON.parse;
    unsafeWindow.JSON.parse = new Proxy(originalJsonParse, {
        apply(target, thisArg, args) {
            const originalObject = Reflect.apply(target, thisArg, args);
            if (location.pathname.startsWith("/shorts/")) {
                if (originalObject?.entries && Array.isArray(originalObject.entries)) {
                    originalObject.entries = originalObject.entries.filter(entry => !entry?.command?.reelWatchEndpoint?.adClientParams?.isAd);
                }
            }
            return pruneJson(originalObject, keysToPrune);
        }
    });

    const originalFetch = unsafeWindow.fetch;
    unsafeWindow.fetch = function(...args) {
        const url = args[0] instanceof Request ? args[0].url : args[0];
        const playerUrlRegex = /\/playlist\?list=|\/player(?!.*(get_drm_license))|watch\?[tv]=|get_watch\?/;

        if (playerUrlRegex.test(url)) {
            return originalFetch(...args).then(response => {
                if (!response.ok) {
                    return response;
                }
                return response.text().then(text => {
                    try {
                        let json = JSON.parse(text);
                        json = pruneJson(json, keysToPrune);
                        const newResponse = new Response(JSON.stringify(json), {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                        Object.defineProperty(newResponse, 'url', { value: response.url });
                        return newResponse;
                    } catch (e) {
                        return new Response(text, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    }
                });
            });
        }
        return originalFetch(...args);
    };


    // Rule: Proxy for Node.prototype.appendChild to handle iframes
    const appendChildProxy = {
        apply: function(target, thisArg, argumentsList) {
            const result = Reflect.apply(target, thisArg, argumentsList);
            try {
                if (result instanceof HTMLIFrameElement && result.src === 'about:blank' && result.contentWindow) {
                    result.contentWindow.fetch = window.fetch;
                    result.contentWindow.Request = window.Request;
                }
            } catch (e) {
                // Silently fail
            }
            return result;
        }
    };
    Node.prototype.appendChild = new Proxy(Node.prototype.appendChild, appendChildProxy);


    // Rule: Proxy for Promise.prototype.then to handle abnormality detection
    const promiseThenProxy = {
        apply: function(target, thisArg, argumentsList) {
            const onFulfilled = argumentsList[0];
            if (typeof onFulfilled === 'function' && onFulfilled.toString().includes('onAbnormalityDetected')) {
                argumentsList[0] = function() {};
            }
            return Reflect.apply(target, thisArg, argumentsList);
        }
    };
    window.Promise.prototype.then = new Proxy(window.Promise.prototype.then, promiseThenProxy);


    // Rule: SSAP (Server Side Ad Playback) ad segment skipping
    (() => {
        let currentUrl = document.location.href;
        let adSegments = [];
        let adSegmentIds = [];
        let lastAdSegmentIds = '';
        let isProcessingAdSegments = false;

        const originalPush = Array.prototype.push;
        const pushProxy = {
            apply: (target, thisArg, argArray) => {
                if (window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id && argArray[0] && argArray[0] !== window && typeof argArray[0].start === 'number' && argArray[0].end && argArray[0].namespace === 'ssap' && argArray[0].id) {
                    if (!isProcessingAdSegments || argArray[0]?.start !== 0 || adSegmentIds.includes(argArray[0].id)) {
                        adSegments = [];
                        adSegmentIds = [];
                        isProcessingAdSegments = true;
                    }
                    if (isProcessingAdSegments && argArray[0]?.start !== 0 && !adSegmentIds.includes(argArray[0].id)) {
                        originalPush.call(adSegments, argArray[0]);
                        originalPush.call(adSegmentIds, argArray[0].id);
                    }
                }
                return Reflect.apply(target, thisArg, argArray);
            }
        };
        window.Array.prototype.push = new Proxy(window.Array.prototype.push, pushProxy);

        const skipAdSegments = () => {
            const video = document.querySelector('video');
            if (video && adSegments.length) {
                const videoDuration = Math.round(video.duration);
                const lastAdEnd = Math.round(adSegments.at(-1).end / 1000);
                const currentAdIds = adSegmentIds.join(',');

                if (!video.loop && lastAdSegmentIds !== currentAdIds && videoDuration && videoDuration === lastAdEnd) {
                    const firstAdStart = adSegments[0].start / 1000;
                    if (video.currentTime < firstAdStart) {
                        video.currentTime = firstAdStart;
                        isProcessingAdSegments = false;
                        lastAdSegmentIds = currentAdIds;
                    }
                } else if (video.loop && videoDuration && videoDuration === lastAdEnd) {
                    const firstAdStart = adSegments[0].start / 1000;
                     if (video.currentTime < firstAdStart) {
                        video.currentTime = firstAdStart;
                        isProcessingAdSegments = false;
                        lastAdSegmentIds = currentAdIds;
                    }
                }
            }
        };

        document.addEventListener('DOMContentLoaded', () => {
            if (!window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id) return;
            skipAdSegments();
            new MutationObserver(() => {
                if (currentUrl !== document.location.href) {
                    currentUrl = document.location.href;
                    adSegments = [];
                    adSegmentIds = [];
                    isProcessingAdSegments = false;
                }
                skipAdSegments();
            }).observe(document, { childList: true, subtree: true });
        });
    })();
})();