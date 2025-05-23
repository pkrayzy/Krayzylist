// ==UserScript==
// @name         YouTube
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Override YouTube ad-related properties and prune ad JSON responses based on Adblock scriptlet rules.
// @match        *://*.youtube.com/*
// @match        *://*.youtubekids.com/*
// @match        *://*.youtube-nocookie.com/*
// @match        *://*.m.youtube.com/*
// @match        *://*.music.youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /*--------------------------------------------------------------------
   Part 1. Set-Constant scriptlets
   – For example:
   youtube.com, youtubekids.com, youtube-nocookie.com:
       setConstant( 'ytInitialPlayerResponse.playerAds', undefined )
       setConstant( 'ytInitialPlayerResponse.adPlacements', undefined )
       setConstant( 'ytInitialPlayerResponse.adSlots', undefined )
       setConstant( 'playerResponse.adPlacements', undefined )
   And on www.youtube.com:
       setConstant( 'yt.config_.EXPERIMENT_FLAGS.web_bind_fetch', false )
  --------------------------------------------------------------------*/
  function setConstantDeep(propPath, constantValue) {
    const parts = propPath.split('.');
    let target = window;
    // Create parent objects if missing (note: this is a very simple implementation)
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in target)) {
        Object.defineProperty(target, parts[i], {
          configurable: true,
          enumerable: true,
          get: function () {
            return {};
          },
          set: function (val) {}
        });
      }
      target = target[parts[i]];
    }
    // Define the final property as a getter always returning constantValue
    Object.defineProperty(target, parts[parts.length - 1], {
      get: function () {
        return constantValue;
      },
      configurable: false,
      enumerable: true
    });
  }

  // Apply set-constant rules
  setConstantDeep('ytInitialPlayerResponse.playerAds', undefined);
  setConstantDeep('ytInitialPlayerResponse.adPlacements', undefined);
  setConstantDeep('ytInitialPlayerResponse.adSlots', undefined);
  setConstantDeep('playerResponse.adPlacements', undefined);
  setConstantDeep('yt.config_.EXPERIMENT_FLAGS.web_bind_fetch', false);

  /*--------------------------------------------------------------------
   Part 2. Adjust-setTimeout for www.youtube.com
   – When a call uses delay 17000, reduce it (here to nearly zero) so any
     delayed ad scripts run almost immediately (or not at all).
  --------------------------------------------------------------------*/
  if (location.host === "www.youtube.com") {
    const origSetTimeout = window.setTimeout;
    window.setTimeout = function (fn, delay, ...args) {
      if (delay === 17000) {
        delay = 0.001;
      }
      return origSetTimeout(fn, delay, ...args);
    };
  }

  /*--------------------------------------------------------------------
   Part 3. JSON-prune scriptlets
   – Intercept fetch and XHR responses and remove ad-related properties.
   – For www.youtube.com, target URLs containing "/playlist?" or "/player?".
   – For m.youtube.com, music.youtube.com, youtubekids.com, and youtube-nocookie.com,
     also remove a property named "important" as shown in the json-prune rule.
  --------------------------------------------------------------------*/

  // A helper function to recursively remove keys.
  function pruneAdsFromJSON(data, extraKeys = []) {
    if (data && typeof data === 'object') {
      // Delete any top-level properties matching these names.
      const keysToDelete = ["playerAds", "adPlacements", "adSlots"].concat(extraKeys);
      keysToDelete.forEach((key) => {
        if (key in data) {
          delete data[key];
        }
      });
      // Also look for a sub-object called "playerResponse" and remove ad-related keys.
      if (data.playerResponse && typeof data.playerResponse === 'object') {
        keysToDelete.forEach((key) => {
          if (key in data.playerResponse) {
            delete data.playerResponse[key];
          }
        });
      }
      // Recurse into other properties.
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          pruneAdsFromJSON(data[key], extraKeys);
        }
      }
    }
  }

  // Override fetch to intercept and modify JSON responses.
  (function () {
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      const requestUrl = typeof input === 'string' ? input : input.url;

      // Block googlevideo playback requests on certain domains:
      if ((location.host === "www.youtube.com" ||
           location.host === "music.youtube.com" ||
           location.host === "m.youtube.com") &&
          requestUrl.includes("googlevideo.com/videoplayback") &&
          requestUrl.includes("ctier=L") &&
          requestUrl.includes("%2Cctier%2C")) {
        return Promise.reject(new Error("Blocked request by YouTube Adblock Userscript"));
      }

      return origFetch(input, init).then((response) => {
        let shouldPrune = false;
        let extra = [];
        if (location.host === "www.youtube.com") {
          if (requestUrl.includes("/playlist?") || requestUrl.includes("/player?")) {
            shouldPrune = true;
          }
        } else if (["m.youtube.com", "music.youtube.com", "youtubekids.com", "youtube-nocookie.com"].includes(location.host)) {
          shouldPrune = true;
          extra.push("important");
        }
        if (shouldPrune) {
          return response.clone().text().then((txt) => {
            try {
              let jsonData = JSON.parse(txt);
              pruneAdsFromJSON(jsonData, extra);
              return new Response(JSON.stringify(jsonData), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
              });
            } catch (e) {
              return response;
            }
          }).catch(() => response);
        }
        return response;
      });
    };
  })();

  // Override XMLHttpRequest to intercept responses.
  (function () {
    const origXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
      this._xhrUrl = url;
      this._pruneResponse = false;
      this._pruneExtra = false;
      if ((location.host === "www.youtube.com" ||
           location.host === "music.youtube.com" ||
           location.host === "m.youtube.com") &&
          url.includes("googlevideo.com/videoplayback") &&
          url.includes("ctier=L") &&
          url.includes("%2Cctier%2C")) {
        // Block the request outright.
        this.abort();
        return;
      }
      if (location.host === "www.youtube.com" && /\/player(?:\?.+)?$/.test(url)) {
        this._pruneResponse = true;
      }
      if (["m.youtube.com", "music.youtube.com", "youtubekids.com", "youtube-nocookie.com"].includes(location.host)) {
        this._pruneResponse = true;
        this._pruneExtra = true;
      }
      return origXHROpen.apply(this, arguments);
    };

    // Intercept access to responseText and modify it on the fly.
    const origResponseTextDescriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
    Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
      get: function () {
        const text = origResponseTextDescriptor.get.apply(this);
        if (this._pruneResponse && typeof text === 'string' && text.length > 0) {
          try {
            let jsonData = JSON.parse(text);
            pruneAdsFromJSON(jsonData, this._pruneExtra ? ["important"] : []);
            return JSON.stringify(jsonData);
          } catch (e) {
            return text;
          }
        }
        return text;
      }
    });
  })();

})();