// ==UserScript==
// @name         Background Playback Enabler
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Prevents YouTube and other sites from pausing video when switching tabs or minimizing the window.
// @author       Claude
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://music.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @match        https://youtube-nocookie.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 1. Spoof Visibility State
    // This prevents the website from knowing the tab is hidden.
    const enableBackgroundPlayback = () => {
        // Block visibility change events from reaching the website's scripts
        const blockEvent = (e) => {
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
        };

        document.addEventListener("visibilitychange", blockEvent, true);
        document.addEventListener("webkitvisibilitychange", blockEvent, true);
        window.addEventListener("pagehide", blockEvent, true);

        // Force the properties to always return 'visible'
        Object.defineProperties(document, {
            hidden: { value: false, writable: false, configurable: true },
            visibilityState: { value: "visible", writable: false, configurable: true }
        });

        console.log("Background playback enabled: Visibility spoofed.");
    };

    // Initial check and listener for the first time the page becomes visible
    if (document.visibilityState === "visible") {
        enableBackgroundPlayback();
    } else {
        document.addEventListener("visibilitychange", function handler() {
            if (document.visibilityState === "visible") {
                document.removeEventListener("visibilitychange", handler, true);
                enableBackgroundPlayback();
            }
        }, true);
    }

    // 2. Prevent Browser Playback Restrictions
    // Monitor for video elements and force them to allow background/remote playback.
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeName === 'VIDEO') {
                    setupVideo(node);
                } else if (node.querySelectorAll) {
                    node.querySelectorAll('video').forEach(setupVideo);
                }
            });
        });
    });

    function setupVideo(video) {
        // Disable restrictions that might pause video during backgrounding or wireless handoff
        if (video.webkitWirelessVideoPlaybackDisabled) {
            video.webkitWirelessVideoPlaybackDisabled = false;
        }
        if (video.disableRemotePlayback) {
            video.disableRemotePlayback = false;
        }
    }

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

})();
