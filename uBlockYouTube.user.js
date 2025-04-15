// ==UserScript==
// @name        uBlockYouTube
// @description  Tries to emulate several uBlock Origin scriptlets for YouTube by modifying global variables and intercepting JSON responses.
// @match        *://www.youtube.com/*
// @match        *://m.youtube.com/*
// @match        *://music.youtube.com/*
// @match        *://youtubekids.com/*
// @match        *://youtube-nocookie.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /**************************************************************************
    Scriptlet 1–4: ubo-set.js for ytInitialPlayerResponse and playerResponse properties
    ---------------------------------------------------------------------------
    These set the following properties to undefined:
      - ytInitialPlayerResponse.playerAds
      - ytInitialPlayerResponse.adPlacements
      - ytInitialPlayerResponse.adSlots
      - playerResponse.adPlacements
    **************************************************************************/
    function uboSetProperties() {
        try {
            if (window.ytInitialPlayerResponse && typeof window.ytInitialPlayerResponse === 'object') {
                window.ytInitialPlayerResponse.playerAds = undefined;
                window.ytInitialPlayerResponse.adPlacements = undefined;
                window.ytInitialPlayerResponse.adSlots = undefined;
            }
        } catch(e) { /* ignore errors */ }
        try {
            if (window.playerResponse && typeof window.playerResponse === 'object') {
                window.playerResponse.adPlacements = undefined;
            }
        } catch(e) { /* ignore errors */ }
    }

    // Run early; if these objects later get redefined by YouTube, we use a setter observer below.
    uboSetProperties();

    // Observe when script defines these properties.
    function definePropertyInterceptor(objName, propName, value) {
        try {
            let originalDescriptor = Object.getOwnPropertyDescriptor(window, objName) || {};
            let currentValue = window[objName];
            Object.defineProperty(window, objName, {
                configurable: true,
                enumerable: originalDescriptor.enumerable !== false,
                get() {
                    return currentValue;
                },
                set(newVal) {
                    currentValue = newVal;
                    // When the object is set, remove the ad properties if present.
                    if (newVal && typeof newVal === 'object' && propName in newVal) {
                        newVal[propName] = value;
                    }
                }
            });
        } catch(e) {
            // Fallback silently.
        }
    }

    // Intercept setting for ytInitialPlayerResponse and playerResponse if they are redefined.
    definePropertyInterceptor('ytInitialPlayerResponse', 'playerAds', undefined);
    definePropertyInterceptor('ytInitialPlayerResponse', 'adPlacements', undefined);
    definePropertyInterceptor('ytInitialPlayerResponse', 'adSlots', undefined);
    definePropertyInterceptor('playerResponse', 'adPlacements', undefined);

    /**************************************************************************
    Scriptlet 10: Set yt.config_.EXPERIMENT_FLAGS.web_bind_fetch to false
    **************************************************************************/
    function disableWebBindFetch() {
        try {
            if (window.yt && window.yt.config_ && window.yt.config_.EXPERIMENT_FLAGS) {
                window.yt.config_.EXPERIMENT_FLAGS.web_bind_fetch = false;
            }
        } catch(e) { /* ignore errors */ }
    }
    disableWebBindFetch();

    /**************************************************************************
    Scriptlets 6–9: JSON response pruning for fetch and XHR
    ---------------------------------------------------------------------------
    For URL patterns matching /playlist? and /player? (and similar), we modify
    fetched JSON responses to remove ad-related properties.
    
    The following properties are intended for removal anywhere they are found:
      playerAds, adPlacements, adSlots, and also within nested "playerResponse" objects.
    **************************************************************************/

    // The list of property names we want to prune.
    const propsToPrune = [
        'playerAds',
        'adPlacements',
        'adSlots'
    ];

    // Deeply search an object (or array) and for any property matching our list,
    // delete it. Also, if a property is an object with a nested "playerResponse", prune it.
    function deepPrune(obj) {
        if (obj && typeof obj === 'object') {
            // If it's an array, iterate each element.
            if (Array.isArray(obj)) {
                obj.forEach(item => deepPrune(item));
            } else {
                for (let key in obj) {
                    if (!obj.hasOwnProperty(key)) continue;
                    // If the key is in our list, delete it.
                    if (propsToPrune.includes(key)) {
                        delete obj[key];
                    } else {
                        // Also check if the property is an object or array.
                        let val = obj[key];
                        if (val && typeof val === 'object') {
                            deepPrune(val);
                        }
                    }
                }
            }
        }
    }

    // Utility: Check if URL matches one of our patterns.
    function urlMatches(url, pattern) {
        // We consider 'pattern' as a substring or regex-like if delimited by /.../
        if (pattern.startsWith('/') && pattern.endsWith('/')) {
            let regexStr = pattern.slice(1, -1);
            let regex = new RegExp(regexStr);
            return regex.test(url);
        } else {
            return url.indexOf(pattern) !== -1;
        }
    }

    // For fetch: intercept responses for specific URL patterns.
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function(input, init) {
        let url = typeof input === 'string' ? input : (input && input.url);
        let needsPruning = false;
        if (url) {
            // Check several patterns used in the rules:
            if (url.indexOf('/playlist?') !== -1 ||
                url.indexOf('/player?') !== -1 ||
                urlMatches(url, '/\\/player(?:\\?.+)?$/')) {
                needsPruning = true;
            }
        }
        try {
            const response = await originalFetch(input, init);
            const clone = response.clone();
            // Only process JSON responses.
            const contentType = response.headers.get('content-type') || "";
            if (needsPruning && contentType.includes("application/json")) {
                let data = await clone.json();
                deepPrune(data);
                // Create a new response with pruned JSON.
                const prunedBody = JSON.stringify(data);
                const modifiedResponse = new Response(prunedBody, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
                return modifiedResponse;
            }
            return response;
        } catch (err) {
            console.error("[uBO Scriptlet Userscript] Error intercepting fetch:", err);
            return originalFetch(input, init);
        }
    };

    // For XMLHttpRequest responses, override the onreadystatechange callback.
    const originalXHR = window.XMLHttpRequest;
    function ModifiedXHR() {
        const xhr = new originalXHR();

        // Save original open method.
        const originalOpen = xhr.open;
        xhr.open = function(method, url) {
            xhr._url = url;
            originalOpen.apply(xhr, arguments);
        };

        // Save original send method.
        const originalSend = xhr.send;
        xhr.send = function() {
            // Add readystatechange listener.
            xhr.addEventListener('readystatechange', function() {
                if (xhr.readyState === 4) {
                    let url = xhr._url || "";
                    if ((url.indexOf('/player?') !== -1 || urlMatches(url, '/\\/player(?:\\?.+)?$/')) &&
                        xhr.getResponseHeader("content-type") &&
                        xhr.getResponseHeader("content-type").includes("application/json")
                    ) {
                        try {
                            // Attempt to override the responseText using a getter.
                            let originalResponseText = xhr.responseText;
                            let data = JSON.parse(originalResponseText);
                            deepPrune(data);
                            let prunedText = JSON.stringify(data);
                            
                            // Redefine responseText and response properties.
                            Object.defineProperty(xhr, "responseText", { value: prunedText });
                            Object.defineProperty(xhr, "response", { value: prunedText });
                        } catch(e) {
                            // Parsing failed.
                            console.error("[uBO Scriptlet Userscript] Error pruning XHR response:", e);
                        }
                    }
                }
            });
            originalSend.apply(xhr, arguments);
        };

        return xhr;
    }

    // Override the global XMLHttpRequest with our modified version.
    window.XMLHttpRequest = ModifiedXHR;

    /**************************************************************************
    Scriptlet 5: ubo-nano-stb.js (stub-delay workaround)
    ---------------------------------------------------------------------------
    The ubo-nano-stb.js scriptlet (with arguments "[native code]", "17000", "0.001")
    is generally aimed at bypassing ad-block bypass techniques. Here we provide a stub
    that delays the execution of a specified function by a small amount if needed.
    
    In this example we simply log that such a stub is in place. (A full emulation
    might require wrapping native functions like Function.prototype.toString.)
    **************************************************************************/
    (function uboNanoSTB() {
        // This is a simplified stub. In practice, uBlock Origin’s nano-stb scriptlet
        // rewrites native code functions to hide ad blocking.
        // For demonstration purposes, we do not modify native functions here.
        // Instead, we log an informational message.
        console.log("[uBO Nano-STB] Stub active: native function alterations are not performed in userscripts.");
        // If desired, one might override Function.prototype.toString here, but that can break page functionality.
    })();

    /**************************************************************************
    Scriptlet 9: Additional JSON pruning via deep scan
    ---------------------------------------------------------------------------
    The above fetch and XHR patches already perform a deep prune of the JSON responses.
    If additional pruning is needed on objects available on page load, you could call:
          deepPrune(window.someObject)
    This script does not automatically traverse all globals.
    **************************************************************************/

    /**************************************************************************
    Final notes:
      • This userscript is an approximate conversion of the uBlock Origin scriptlets.
      • Due to the limited ability of userscripts to intercept requests and modify native functions,
        it might not be 100% equivalent.
      • uBlock Origin itself uses a privileged API and low-level interception which is not fully reproducible here.
    **************************************************************************/

})();