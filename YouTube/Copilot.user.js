// ==UserScript==
// @name         YouTube Ad Pruner & Tweaks
// @namespace    http://your.namespace.here
// @version      1.0
// @description  Applies constant overrides, prunes JSON response ad keys, adjusts setTimeout delays, fixes iframe fetch in blank pages, and patches Promises and video ssap behavior on YouTube variants.
// @match        *://*.youtube.com/*
// @match        *://*.youtube-nocookie.com/*
// @match        *://*.youtubekids.com/*
// @match        *://m.youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  /* ---------------------------------------------------------------------------
     1. SET CONSTANTS (scriptlet 'set-constant')
     For youtubekids.com, youtube.com, youtube-nocookie.com we set:
       ytInitialPlayerResponse.adPlacements
       ytInitialPlayerResponse.adSlots
       ytInitialPlayerResponse.playerAds
       playerResponse.adPlacements
  --------------------------------------------------------------------------- */
  function setConstant(path, value) {
    const parts = path.split(".");
    const last = parts.pop();
    let target = window;
    for (const part of parts) {
      if (!(part in target)) return;
      target = target[part];
    }
    target[last] = value;
  }
  setConstant("ytInitialPlayerResponse.adPlacements", undefined);
  setConstant("ytInitialPlayerResponse.adSlots", undefined);
  setConstant("ytInitialPlayerResponse.playerAds", undefined);
  setConstant("playerResponse.adPlacements", undefined);

  /* ---------------------------------------------------------------------------
     2. JSON PRUNING (scriptlet 'json-prune', 'json-prune-xhr-response',
        'json-prune-fetch-response' and also additional tv-specific prunes)
     
     We override JSON.parse and Response.prototype.json so that whenever
     JSON is parsed (be it by page code or fetch/XHR), we remove keys
     related to ads – namely:
       playerResponse.adPlacements
       playerResponse.adSlots
       playerResponse.playerAds
     Additionally, if these appear in ytInitialPlayerResponse or at top–level,
     they are removed.
     
     (The tv-specific rule is applied when location.href includes "/tv".)
  --------------------------------------------------------------------------- */
  function pruneJSON(obj) {
    if (obj && typeof obj === "object") {
      if (obj.playerResponse && typeof obj.playerResponse === "object") {
        delete obj.playerResponse.adPlacements;
        delete obj.playerResponse.adSlots;
        delete obj.playerResponse.playerAds;
      }
      if (obj.ytInitialPlayerResponse && typeof obj.ytInitialPlayerResponse === "object") {
        delete obj.ytInitialPlayerResponse.adPlacements;
        delete obj.ytInitialPlayerResponse.adSlots;
        delete obj.ytInitialPlayerResponse.playerAds;
      }
      // Also remove bare keys if present.
      ["adPlacements", "adSlots", "playerAds"].forEach(key => {
        if (key in obj) delete obj[key];
      });
    }
    return obj;
  }

  const originalJSONParse = JSON.parse;
  JSON.parse = function () {
    const result = originalJSONParse.apply(this, arguments);
    try {
      return pruneJSON(result);
    } catch (e) {
      return result;
    }
  };

  const originalResponseJson = Response.prototype.json;
  Response.prototype.json = new Proxy(originalResponseJson, {
    apply(target, thisArg, argumentsList) {
      const promise = Reflect.apply(target, thisArg, argumentsList);
      return promise.then(data => pruneJSON(data));
    }
  });

  // (For XHR responses, we attach a listener so if the responseText is JSON,
  // we at least call JSON.parse which is now pruned.)
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("readystatechange", function () {
      if (this.readyState === 4 && this.responseType === "" && this.responseText) {
        try {
          JSON.parse(this.responseText);
        } catch (e) {
          // non-JSON response
        }
      }
    });
    return originalXHRSend.apply(this, arguments);
  };

  // For tv pages, if location has "/tv", we reapply our JSON.parse override.
  if (location.href.includes("/tv")) {
    const originalJSONParseTv = originalJSONParse;
    JSON.parse = function () {
      const result = originalJSONParseTv.apply(this, arguments);
      return pruneJSON(result);
    };
  }

  /* ---------------------------------------------------------------------------
     3. ADJUST IFRAME FETCH (rule that patches Node.appendChild)
     
     When an iframe is appended and is "about:blank", we copy over fetch and Request
     from the parent window.
  --------------------------------------------------------------------------- */
  const originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = new Proxy(originalAppendChild, {
    apply(target, thisArg, args) {
      const node = args[0];
      try {
        if (
          node instanceof HTMLIFrameElement &&
          node.src === "about:blank" &&
          node.contentWindow
        ) {
          node.contentWindow.fetch = window.fetch;
          node.contentWindow.Request = window.Request;
        }
      } catch (e) {
        // Ignore errors.
      }
      return Reflect.apply(target, thisArg, args);
    }
  });

  /* ---------------------------------------------------------------------------
     4. JSON PRUNING on OTHER DOM and PROMISES
     
     Rule: For m.youtube.com, youtubekids.com, youtube-nocookie.com – the JSON
     pruning is globally applied by our JSON.parse override.
     
     Additionally, we patch Promise.prototype.then to intercept functions that
     include the substring "onAbnormalityDetected". If found, we replace them with a no‑op.
  --------------------------------------------------------------------------- */
  const originalPromiseThen = Promise.prototype.then;
  Promise.prototype.then = new Proxy(originalPromiseThen, {
    apply(target, thisArg, args) {
      if (
        args[0] &&
        typeof args[0] === "function" &&
        String(args[0]).includes("onAbnormalityDetected")
      ) {
        args[0] = function () {};
      }
      return Reflect.apply(target, thisArg, args);
    }
  });

  /* ---------------------------------------------------------------------------
     5. ADJUST SETTIMEOUT (rule 'adjust-setTimeout')
     
     We intercept setTimeout calls. When a delay is exactly 17000, we force it to 0.001.
  --------------------------------------------------------------------------- */
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = new Proxy(originalSetTimeout, {
    apply(target, thisArg, args) {
      if (args[1] === 17000) {
        args[1] = 0.001;
      }
      return Reflect.apply(target, thisArg, args);
    }
  });

  /* ---------------------------------------------------------------------------
     6. VIDEO PLAYBACK ADJUSTMENT (long function – rule #13)
     
     This block watches for appended "ssap" info in arrays (which may be pushed
     into window arrays by YouTube) and, once a video element is present, it adjusts
     its currentTime to skip ads if necessary.
  --------------------------------------------------------------------------- */
  (function () {
    let lastURL = document.location.href;
    let ssapSegments = [];
    let ssapIds = [];
    let lastKey = "";
    let triggered = false;
    const origPush = Array.prototype.push;
    const pushProxy = {
      apply(target, thisArg, args) {
        const arg0 = args[0];
        if (
          window.yt &&
          window.yt.config_ &&
          window.yt.config_.EXPERIMENT_FLAGS &&
          window.yt.config_.EXPERIMENT_FLAGS.html5_enable_ssap_entity_id &&
          arg0 &&
          arg0 !== window &&
          typeof arg0.start === "number" &&
          arg0.end &&
          arg0.namespace === "ssap" &&
          arg0.id
        ) {
          if (!triggered && arg0.start !== 0 && !ssapIds.includes(arg0.id)) {
            ssapSegments.length = 0;
            ssapIds.length = 0;
            triggered = true;
            origPush.call(ssapSegments, arg0);
            origPush.call(ssapIds, arg0.id);
          } else if (triggered && arg0.start !== 0 && !ssapIds.includes(arg0.id)) {
            origPush.call(ssapSegments, arg0);
            origPush.call(ssapIds, arg0.id);
          }
        }
        return Reflect.apply(target, thisArg, args);
      },
    };
    Array.prototype.push = new Proxy(Array.prototype.push, pushProxy);

    document.addEventListener("DOMContentLoaded", function () {
      if (
        !window.yt ||
        !window.yt.config_ ||
        !window.yt.config_.EXPERIMENT_FLAGS ||
        !window.yt.config_.EXPERIMENT_FLAGS.html5_enable_ssap_entity_id
      )
        return;
      const adjustVideo = () => {
        const video = document.querySelector("video");
        if (video && ssapSegments.length) {
          const duration = Math.round(video.duration);
          const lastEnd = Math.round(ssapSegments.at(-1).end / 1000);
          const curKey = ssapIds.join(",");
          if (!video.loop && lastKey !== curKey && duration && duration === lastEnd) {
            const startSeconds = ssapSegments.at(-1).start / 1000;
            if (video.currentTime < startSeconds) {
              video.currentTime = startSeconds;
              triggered = false;
              lastKey = curKey;
            }
          } else if (video.loop && duration && duration === lastEnd) {
            const startSeconds = ssapSegments.at(-1).start / 1000;
            if (video.currentTime < startSeconds) {
              video.currentTime = startSeconds;
              triggered = false;
              lastKey = curKey;
            }
          }
        }
      };
      adjustVideo();
      new MutationObserver(() => {
        if (lastURL !== document.location.href) {
          lastURL = document.location.href;
          ssapSegments.length = 0;
          ssapIds.length = 0;
          triggered = false;
        }
        adjustVideo();
      }).observe(document, { childList: true, subtree: true });
    });
  })();

  /* ---------------------------------------------------------------------------
     7. JSON.parse PATCH FOR SHORTS (rule #14)
     
     For /shorts/ pages, we patch JSON.parse so that if the result contains an
     "entries" array, we filter out any entries which have ad detection flagged.
  --------------------------------------------------------------------------- */
  JSON.parse = new Proxy(JSON.parse, {
    apply(target, thisArg, args) {
      const result = Reflect.apply(target, thisArg, args);
      if (!location.pathname.startsWith("/shorts/")) return result;
      if (result && result.entries && Array.isArray(result.entries)) {
        result.entries = result.entries.filter(entry => {
          return !(
            entry &&
            entry.command &&
            entry.command.reelWatchEndpoint &&
            entry.command.reelWatchEndpoint.adClientParams &&
            entry.command.reelWatchEndpoint.adClientParams.isAd
          );
        });
      }
      return result;
    },
  });
})();
