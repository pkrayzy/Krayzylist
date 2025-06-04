// ==UserScript==
// @name         YouTube
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Override YouTube ad-related properties and prune ad JSON responses based on Adblock scriptlet rules.
// @match        *://*.youtube.com/*
// @match        *://*.youtubekids.com/*
// @match        *://*.youtube-nocookie.com/*
// @match        *://*.m.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  /**********************************************************************
   * Helper: Delete property by “dotted” path.
   **********************************************************************/
  function deletePath(obj, path) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur && typeof cur === "object") cur = cur[parts[i]];
      else return;
    }
    if (cur && typeof cur === "object") {
      try {
        delete cur[parts[parts.length - 1]];
      } catch (e) {
        // some properties may be non-configurable…
      }
    }
  }

  /**********************************************************************
   * Scriptlet “set-constant”: Override given properties to undefined.
   *
   * For each requested constant property (eg. "ytInitialPlayerResponse.adPlacements"),
   * we poll until its parent object exists, then redefine the property.
   **********************************************************************/
  function setConstant(path, constantValue) {
    const parts = path.split(".");
    const prop = parts.pop();
    function tryOverride() {
      let parent = window;
      for (const seg of parts) {
        if (parent[seg] !== undefined) {
          parent = parent[seg];
        } else {
          return false;
        }
      }
      // If the property already exists, redefine it.
      try {
        Object.defineProperty(parent, prop, { value: constantValue, writable: false, configurable: true });
      } catch (e) {
        // If error thrown, likely non-configurable. We'll ignore it.
      }
      return true;
    }
    const intv = setInterval(() => {
      if (tryOverride()) {
        clearInterval(intv);
      }
    }, 50);
  }

  // Apply set-constant rules:
  setConstant("ytInitialPlayerResponse.adPlacements", undefined);
  setConstant("ytInitialPlayerResponse.adSlots", undefined);
  setConstant("ytInitialPlayerResponse.playerAds", undefined);
  setConstant("playerResponse.adPlacements", undefined);

  /**********************************************************************
   * Scriptlet “json-prune”: Override JSON.parse to prune ad data.
   *
   * For non-XHR (regular JSON.parse calls) on youtube.com pages (but not /shorts/),
   * we remove the properties "playerResponse.adPlacements" and "playerResponse.adSlots".
   **********************************************************************/
  if (window.location.hostname.includes("youtube.com") &&
      !window.location.pathname.startsWith("/shorts/")) {
    const origJSONParse = JSON.parse;
    JSON.parse = function (text, reviver) {
      let json;
      try {
        json = origJSONParse(text, reviver);
      } catch (e) {
        return origJSONParse(text, reviver);
      }
      // Prune the keys “playerResponse.adPlacements” and “playerResponse.adSlots”
      deletePath(json, "playerResponse.adPlacements");
      deletePath(json, "playerResponse.adSlots");
      return json;
    };
  }

  /**********************************************************************
   * Scriptlet “json-prune-xhr-response”: Intercept XHR responses.
   *
   * For XHR responses with JSON content from URLs matching a regex (for example,
   * watch URLs and player URLs) remove ad-related properties from the parsed JSON.
   **********************************************************************/
  (function () {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
      this._url = url;
      return origOpen.apply(this, arguments);
    };

    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
      this.addEventListener("load", function () {
        const contentType = this.getResponseHeader("content-type") || "";
        if (contentType.includes("application/json") &&
            /playlist\?list=|\/player(?!.*(get_drm_license))|watch\?[tv]=|get_watch\?/.test(this._url)) {
          try {
            let json = JSON.parse(this.responseText);
            [
              "playerResponse.adPlacements",
              "playerResponse.playerAds",
              "playerResponse.adSlots",
              "adPlacements",
              "playerAds",
              "adSlots"
            ].forEach((path) => {
              deletePath(json, path);
            });
            // Replace responseText – this is a hack since responseText is normally read-only.
            Object.defineProperty(this, "responseText", { value: JSON.stringify(json) });
          } catch (e) {
            // If JSON parsing fails, do nothing.
          }
        }
      });
      return origSend.apply(this, arguments);
    };
  })();

  /**********************************************************************
   * Scriptlet “json-prune-fetch-response”: Intercept fetch responses.
   *
   * For fetch responses with JSON content from matching URLs, we clone the response,
   * prune ad-related properties, and return a new response.
   **********************************************************************/
  (function () {
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      return origFetch(input, init).then((response) => {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json") &&
            /playlist\?list=|player\?|watch\?[tv]=|get_watch\?/.test(response.url)) {
          // Clone and modify the response text.
          return response.clone().text().then((text) => {
            try {
              let json = JSON.parse(text);
              [
                "playerResponse.adPlacements",
                "playerResponse.playerAds",
                "playerResponse.adSlots",
                "adPlacements",
                "playerAds",
                "adSlots"
              ].forEach((path) => {
                deletePath(json, path);
              });
              const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
              return new Response(blob, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
              });
            } catch (e) {
              return response;
            }
          });
        }
        return response;
      });
    };
  })();

  /**********************************************************************
   * Adjust iframe contentWindow fetch support.
   *
   * (Equivalent to: www.youtube.com#%#//scriptlet('...appendChild' override)
   **********************************************************************/
  (() => {
    const handler = {
      apply(target, thisArg, argumentsList) {
        const result = Reflect.apply(target, thisArg, argumentsList);
        try {
          if (result instanceof HTMLIFrameElement &&
              result.src === "about:blank" &&
              result.contentWindow) {
            result.contentWindow.fetch = window.fetch;
            result.contentWindow.Request = window.Request;
          }
        } catch (e) {}
        return result;
      }
    };
    Node.prototype.appendChild = new Proxy(Node.prototype.appendChild, handler);
  })();

  /**********************************************************************
   * For m.youtube.com, youtubekids.com and youtube-nocookie.com pages,
   * also prune JSON via overriding JSON.parse (if not intercepted by XHR or fetch).
   **********************************************************************/
  if (/m\.youtube\.com|youtubekids\.com|youtube-nocookie\.com/.test(window.location.hostname)) {
    const origJSONParse2 = JSON.parse;
    JSON.parse = function (text, reviver) {
      let json = origJSONParse2(text, reviver);
      [
        "playerResponse.adPlacements",
        "playerResponse.playerAds",
        "playerResponse.adSlots",
        "adPlacements",
        "playerAds",
        "adSlots"
      ].forEach((path) => {
        deletePath(json, path);
      });
      return json;
    };
  }

  /**********************************************************************
   * Scriptlet for Promise.then patch.
   *
   * Disable functions which include a call to "onAbnormalityDetected".
   **********************************************************************/
  (() => {
    const handler = {
      apply(target, thisArg, args) {
        const callback = args[0];
        if (typeof callback === "function" && callback.toString().includes("onAbnormalityDetected")) {
          args[0] = function () { }; // neutralize
        }
        return Reflect.apply(target, thisArg, args);
      }
    };
    window.Promise.prototype.then = new Proxy(window.Promise.prototype.then, handler);
  })();

  /**********************************************************************
   * (Conditional) Rule for YouTube TV Pages – if URL matches /tv.
   *
   * We perform JSON pruning with the same keys as above.
   **********************************************************************/
  if (/\?/.test(location.href) && /tv/.test(location.href)) {
    // For pages loaded on /tv, override JSON.parse similarly.
    const origJSONParseTV = JSON.parse;
    JSON.parse = function (text, reviver) {
      let json = origJSONParseTV(text, reviver);
      [
        "playerResponse.adPlacements",
        "playerResponse.playerAds",
        "playerResponse.adSlots",
        "adPlacements",
        "playerAds",
        "adSlots"
      ].forEach((path) => {
        deletePath(json, path);
      });
      return json;
    };
  }

  /**********************************************************************
   * Scriptlet “adjust-setTimeout”: Adjust timeouts.
   *
   * When setTimeout is called with a delay of 17000,
   * adjust it to 0.001.
   **********************************************************************/
  (function () {
    const origSetTimeout = window.setTimeout;
    window.setTimeout = function (callback, delay, ...args) {
      if (delay === 17000) {
        delay = 0.001;
      }
      return origSetTimeout(callback, delay, ...args);
    };
  })();

  /**********************************************************************
   * Scriptlet that intercepts Array.prototype.push to track “ssap” playback data.
   *
   * This code intercepts pushes to arrays (likely part of the YouTube SSAP system)
   * and then adjusts video currentTime if certain conditions hold.
   **********************************************************************/
  (function () {
    let lastHref = document.location.href,
      segments = [],
      ids = [],
      lastIDs = "",
      triggered = false;
    const nativePush = Array.prototype.push;
    const handler = {
      apply(target, thisArg, args) {
        const firstArg = args[0];
        if (
          typeof firstArg === "function" &&
          firstArg.toString().includes("onAbnormalityDetected")
        ) {
          // Cancel problematic abnormality detection
          args[0] = function () { };
        } else if (
          window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id &&
          firstArg &&
          firstArg !== window &&
          typeof firstArg.start === "number" &&
          firstArg.end &&
          firstArg.namespace === "ssap" &&
          firstArg.id
        ) {
          if (!triggered && firstArg.start === 0) {
            // clear previous buffers on initial push
            segments.length = 0;
            ids.length = 0;
            triggered = true;
            nativePush.call(segments, firstArg);
            nativePush.call(ids, firstArg.id);
          } else if (triggered && firstArg.start !== 0 && !ids.includes(firstArg.id)) {
            nativePush.call(segments, firstArg);
            nativePush.call(ids, firstArg.id);
          }
        }
        return Reflect.apply(target, thisArg, args);
      }
    };
    Array.prototype.push = new Proxy(Array.prototype.push, handler);

    document.addEventListener("DOMContentLoaded", function () {
      if (!window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id) return;
      const checkVideo = () => {
        const video = document.querySelector("video");
        if (video && segments.length) {
          const dur = Math.round(video.duration),
            segEnd = Math.round(segments.at(-1).end / 1000),
            idStr = ids.join(",");
          if (!video.loop && lastIDs !== idStr && dur && dur === segEnd) {
            const segStart = segments.at(-1).start / 1000;
            if (video.currentTime < segStart) {
              video.currentTime = segStart;
              triggered = false;
              lastIDs = idStr;
            }
          } else if (video.loop && dur && dur === segEnd) {
            const segStart = segments.at(-1).start / 1000;
            if (video.currentTime < segStart) {
              video.currentTime = segStart;
              triggered = false;
              lastIDs = idStr;
            }
          }
        }
      };
      checkVideo();
      new MutationObserver(() => {
        if (lastHref !== document.location.href) {
          lastHref = document.location.href;
          segments.length = 0;
          ids.length = 0;
          triggered = false;
        }
        checkVideo();
      }).observe(document, { childList: true, subtree: true });
    });
  })();

  /**********************************************************************
   * Scriptlet to patch JSON.parse on /shorts/ pages so that ad entries are removed.
   **********************************************************************/
  (function () {
    const origJSONParse = JSON.parse;
    window.JSON.parse = new Proxy(JSON.parse, {
      apply(target, thisArg, argumentsList) {
        const result = Reflect.apply(target, thisArg, argumentsList);
        if (!location.pathname.startsWith("/shorts/")) return result;
        const entries = result && result.entries;
        if (Array.isArray(entries)) {
          result.entries = entries.filter((item) => {
            // Keep the entry only if it does not have an ad flag
            return !(item?.command?.reelWatchEndpoint?.adClientParams?.isAd);
          });
        }
        return result;
      },
    });
  })();

  // End of userscript.
})();
