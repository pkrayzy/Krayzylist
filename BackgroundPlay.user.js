// ==UserScript==
// @name         Background Playback Enabler
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Prevents YouTube and other sites from pausing video when switching tabs, minimizing, or locking the screen (Safari/iOS).
// @author       Claude
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://music.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @match        https://youtube-nocookie.com/*
// @grant        none
// @run-at       document-start
// @inject-into  page
// ==/UserScript==

(function () {
    'use strict';

    // ------------------------------------------------------------------
    // 1. Preserve Native Visibility State
    // ------------------------------------------------------------------
    function findGetter(target, prop) {
        let proto = target;
        while (proto) {
            const desc = Object.getOwnPropertyDescriptor(proto, prop);
            if (desc && typeof desc.get === 'function') return desc.get;
            proto = Object.getPrototypeOf(proto);
        }
        return null;
    }

    const nativeHiddenGetter = findGetter(document, 'hidden') || findGetter(document, 'webkitHidden');

    function isRealHidden() {
        try {
            return nativeHiddenGetter ? nativeHiddenGetter.call(document) : false;
        } catch (_) {
            return false;
        }
    }

    // ------------------------------------------------------------------
    // 2. Spoof Document Visibility for Page Scripts
    // ------------------------------------------------------------------
    function spoofVisibility(target) {
        const props = {
            hidden: () => false,
            visibilityState: () => 'visible',
            webkitHidden: () => false,
            webkitVisibilityState: () => 'visible'
        };
        for (const [key, getter] of Object.entries(props)) {
            try {
                Object.defineProperty(target, key, {
                    get: getter,
                    configurable: true,
                    enumerable: true
                });
            } catch (_) {}
        }
    }

    spoofVisibility(document);
    if (typeof Document !== 'undefined' && Document.prototype) {
        spoofVisibility(Document.prototype);
    }

    // ------------------------------------------------------------------
    // 3. User Intent & System Pause Tracking
    // ------------------------------------------------------------------
    let userIntentPause = false;
    let lastInputTime = 0;
    let lastPagePauseTime = 0;
    let heldForHide = null;

    let recoveryRetries = 0;
    let recoveryWindowStart = 0;
    const RECOVERY_BUDGET = 3;
    const RECOVERY_WINDOW_MS = 6000;
    const INPUT_GRACE_MS = 1000;
    const PAGE_CALL_GRACE_MS = 150;
    const HIDE_LEAD_MS = 1500;

    // Track user input (clicks, taps, keyboard shortcuts like Space / 'K')
    const onUserInput = () => { lastInputTime = performance.now(); };
    const inputOptions = { capture: true, passive: true };
    ['pointerup', 'touchend', 'click', 'keydown'].forEach(evt => {
        window.addEventListener(evt, onUserInput, inputOptions);
    });

    // Track explicit pause() calls from YouTube's own player scripts
    try {
        const origPause = HTMLMediaElement.prototype.pause;
        if (origPause) {
            HTMLMediaElement.prototype.pause = function () {
                lastPagePauseTime = performance.now();
                return origPause.apply(this, arguments);
            };
        }
    } catch (_) {}

    // Hook MediaSession pause/stop (lock screen, Control Center, media keys)
    try {
        const mediaSessionProto = typeof MediaSession !== 'undefined' && MediaSession.prototype;
        const origSetActionHandler = mediaSessionProto && mediaSessionProto.setActionHandler;
        if (origSetActionHandler) {
            mediaSessionProto.setActionHandler = function (action, handler) {
                if ((action === 'pause' || action === 'stop') && typeof handler === 'function') {
                    const originalHandler = handler;
                    handler = function () {
                        userIntentPause = true;
                        return originalHandler.apply(this, arguments);
                    };
                } else if (action === 'play' && typeof handler === 'function') {
                    const originalHandler = handler;
                    handler = function () {
                        userIntentPause = false;
                        return originalHandler.apply(this, arguments);
                    };
                }
                return origSetActionHandler.call(this, action, handler);
            };
        }
    } catch (_) {}

    // Safely resume playback without throwing unhandled promise rejections
    function safePlay(video) {
        if (!video || video.ended || !video.paused) return;
        try {
            const result = video.play();
            if (result && typeof result.catch === 'function') {
                result.catch(() => {});
            }
        } catch (_) {}
    }

    // ------------------------------------------------------------------
    // 4. Capture-Phase Media Event Delegation
    // ------------------------------------------------------------------
    document.addEventListener('play', () => {
        userIntentPause = false;
        heldForHide = null;
    }, true);

    document.addEventListener('playing', () => {
        userIntentPause = false;
        heldForHide = null;
        if (!isRealHidden()) {
            recoveryRetries = 0;
        }
    }, true);

    document.addEventListener('pause', (event) => {
        const video = event.target;
        if (!(video instanceof HTMLMediaElement) || video.ended) return;

        const now = performance.now();

        // Check if pause was initiated by user or script
        const isUserAction = userIntentPause ||
            (now - lastInputTime < INPUT_GRACE_MS) ||
            (now - lastPagePauseTime < PAGE_CALL_GRACE_MS);

        if (isUserAction) return;

        // System/WebKit background pause
        if (isRealHidden()) {
            if (now - recoveryWindowStart > RECOVERY_WINDOW_MS) {
                recoveryRetries = 0;
                recoveryWindowStart = now;
            }
            if (recoveryRetries < RECOVERY_BUDGET) {
                recoveryRetries++;
                safePlay(video);
            }
        } else {
            // WebKit pre-hide pause (pauses 400-900ms before visibilitychange fires)
            heldForHide = { video, time: now };
        }
    }, true);

    // Ensure videos can play inline on mobile WebKit
    document.addEventListener('loadedmetadata', (event) => {
        const video = event.target;
        if (video instanceof HTMLMediaElement && !video.playsInline) {
            video.playsInline = true;
        }
    }, { capture: true, passive: true });

    // ------------------------------------------------------------------
    // 5. Visibility Change Suppression & Background Resume
    // ------------------------------------------------------------------
    function onVisibilityChange(event) {
        const hidden = isRealHidden();

        if (hidden) {
            // Block YouTube from learning the document is hidden
            if (event && typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }

            // Resume videos paused by WebKit right before the hide
            if (heldForHide) {
                const elapsed = performance.now() - heldForHide.time;
                if (elapsed <= HIDE_LEAD_MS && !userIntentPause) {
                    safePlay(heldForHide.video);
                }
                heldForHide = null;
            }
        } else {
            recoveryRetries = 0;
            heldForHide = null;
        }
    }

    window.addEventListener('visibilitychange', onVisibilityChange, true);
    document.addEventListener('visibilitychange', onVisibilityChange, true);
    window.addEventListener('webkitvisibilitychange', onVisibilityChange, true);
    document.addEventListener('webkitvisibilitychange', onVisibilityChange, true);
})();