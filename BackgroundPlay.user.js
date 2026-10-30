// ==UserScript==
// @name         Background Playback Enabler
// @namespace    http://tampermonkey.net/
// @version      1.3
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

(function() {
    'use strict';

    // Capture the native visibility getters BEFORE we shadow them, so we can
    // still tell whether the page is genuinely backgrounded (iOS lock / home).
    function findGetter(obj, name) {
        let proto = obj;
        while (proto) {
            const desc = Object.getOwnPropertyDescriptor(proto, name);
            if (desc && typeof desc.get === 'function') return desc.get;
            proto = Object.getPrototypeOf(proto);
        }
        return null;
    }

    const nativeHiddenGetter = findGetter(document, 'hidden');
    const nativeVSGetter = findGetter(document, 'visibilityState');

    let realHidden = false;
    function updateRealHidden() {
        try {
            realHidden = nativeHiddenGetter ? !!nativeHiddenGetter.call(document) : false;
        } catch (e) {
            realHidden = false;
        }
    }
    updateRealHidden();

    const blockEvent = (e) => {
        try { e.stopImmediatePropagation(); } catch (err) { /* ignore */ }
    };

    // Track whether a pause was requested by the user (lock-screen/media keys,
    // on-page controls, keyboard). Used to avoid auto-resuming an explicit pause.
    let userPaused = false;
    let recentUserInteraction = false;
    let interactionTimer = null;
    function markUserInteraction() {
        recentUserInteraction = true;
        if (interactionTimer) clearTimeout(interactionTimer);
        interactionTimer = setTimeout(function () {
            recentUserInteraction = false;
            interactionTimer = null;
        }, 1200);
    }
    try {
        document.addEventListener('pointerdown', markUserInteraction, true);
        document.addEventListener('mousedown', markUserInteraction, true);
        document.addEventListener('touchstart', markUserInteraction, true);
        document.addEventListener('keydown', markUserInteraction, true);
    } catch (e) { /* ignore */ }

    // Keep our real-visibility tracker in sync, then block other listeners.
    function onVisibilityChange(e) {
        updateRealHidden();
        try { e.stopImmediatePropagation(); } catch (err) { /* ignore */ }
    }

    // 1. Spoof Visibility State (desktop tabs + iOS Safari)
    const enableBackgroundPlayback = () => {
        document.addEventListener('visibilitychange', onVisibilityChange, true);
        document.addEventListener('webkitvisibilitychange', onVisibilityChange, true);
        window.addEventListener('pagehide', blockEvent, true);
        window.addEventListener('freeze', blockEvent, true);

        // Real values the OS/browser computed; we mask them as "visible".
        try {
            Object.defineProperty(document, 'hidden', {
                get: function () { return false; },
                configurable: true
            });
        } catch (e) { /* ignore */ }
        try {
            Object.defineProperty(document, 'visibilityState', {
                get: function () { return 'visible'; },
                configurable: true
            });
        } catch (e) { /* ignore */ }
        try {
            Object.defineProperty(document, 'webkitHidden', {
                get: function () { return false; },
                configurable: true
            });
        } catch (e) { /* ignore */ }
        try {
            Object.defineProperty(document, 'webkitVisibilityState', {
                get: function () { return 'visible'; },
                configurable: true
            });
        } catch (e) { /* ignore */ }

        // YouTube sometimes checks document.hasFocus() as a fallback signal.
        try { document.hasFocus = function () { return true; }; } catch (e) { /* ignore */ }

        console.log('Background playback enabled: Visibility spoofed (Safari).');
    };

    enableBackgroundPlayback();

    // 1b. Media Session hooks so a user-initiated pause (lock-screen button,
    // media keys, OS controls) is honored instead of being auto-resumed.
    (function hookMediaSession() {
        if (!navigator.mediaSession) return;
        let nativeSetActionHandler = null;
        try { nativeSetActionHandler = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession); } catch (e) { nativeSetActionHandler = null; }
        if (!nativeSetActionHandler) return;

        const wrapped = {}; // action -> the handler the page registered (or null)

        function pauseAllVideos() {
            try {
                const videos = document.getElementsByTagName('video');
                for (let i = 0; i < videos.length; i++) {
                    const v = videos[i];
                    if (v && !v.paused) {
                        try { v.pause(); } catch (e) { /* ignore */ }
                    }
                }
            } catch (e) { /* ignore */ }
        }
        function playAllVideos() {
            try {
                const videos = document.getElementsByTagName('video');
                for (let i = 0; i < videos.length; i++) {
                    const v = videos[i];
                    if (v && v.paused && !v.ended) {
                        try { const p = v.play(); if (p && p.catch) p.catch(function(){}); } catch (e) { /* ignore */ }
                    }
                }
            } catch (e) { /* ignore */ }
        }

        // Reuse two static wrappers instead of allocating a closure per call.
        function playWrapper(details) {
            userPaused = false;
            const pageHandler = wrapped.play;
            if (typeof pageHandler === 'function') {
                try { pageHandler(details); } catch (e) { /* ignore */ }
            } else {
                playAllVideos();
            }
        }
        function pauseWrapper(details) {
            userPaused = true;
            const pageHandler = wrapped.pause;
            if (typeof pageHandler === 'function') {
                try { pageHandler(details); } catch (e) { /* ignore */ }
            } else {
                pauseAllVideos();
            }
        }

        navigator.mediaSession.setActionHandler = function (action, handler) {
            wrapped[action] = handler;
            if (action === 'play') {
                try { nativeSetActionHandler('play', playWrapper); } catch (e) { /* ignore */ }
            } else if (action === 'pause') {
                try { nativeSetActionHandler('pause', pauseWrapper); } catch (e) { /* ignore */ }
            } else {
                try { nativeSetActionHandler(action, handler); } catch (e) { /* ignore */ }
            }
        };

        // Install base wrappers up front.
        try { navigator.mediaSession.setActionHandler('play', null); } catch (e) { /* ignore */ }
        try { navigator.mediaSession.setActionHandler('pause', null); } catch (e) { /* ignore */ }
    })();

    // 2. Resume helpers for iOS (screen lock / home swipe pauses the media).
    function resumeVideo(video) {
        if (!video || video.ended) return;
        try {
            if (video.paused) {
                const p = video.play();
                if (p && typeof p.catch === 'function') p.catch(function () { /* ignore */ });
            }
        } catch (e) { /* ignore */ }
        try {
            if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
        } catch (e) { /* ignore */ }
    }

    function resumeAll() {
        try {
            const videos = document.getElementsByTagName('video');
            for (let i = 0; i < videos.length; i++) resumeVideo(videos[i]);
        } catch (e) { /* ignore */ }
    }

    // Keep real-visibility state updated even after page is hidden; fire resumes
    // on transitions (covers pageshow/resume/focus returning).
    document.addEventListener('resume', function () { updateRealHidden(); resumeAll(); }, true);
    window.addEventListener('pageshow', function () { updateRealHidden(); resumeAll(); }, true);
    window.addEventListener('focus', function () { updateRealHidden(); }, true);

    // 3. Per-video setup
    function setupVideo(video) {
        if (!video || video.nodeType !== 1 || video._bgPlaySetup) return;
        video._bgPlaySetup = true;

        if (video.webkitWirelessVideoPlaybackDisabled) {
            try { video.webkitWirelessVideoPlaybackDisabled = false; } catch (e) { /* ignore */ }
        }
        if (video.disableRemotePlayback) {
            try { video.disableRemotePlayback = false; } catch (e) { /* ignore */ }
        }

        // Safari needs playsinline to keep decoded video alive in background/PiP.
        try { video.setAttribute('playsinline', ''); } catch (e) { /* ignore */ }
        try { video.playsInline = true; } catch (e) { /* ignore */ }
        try { video.setAttribute('webkit-playsinline', ''); } catch (e) { /* ignore */ }

        // Auto-resume when iOS pauses us (lock screen / swipe home).
        video.addEventListener('pause', function () {
            if (video.ended) return;
            const explicitUserPause = userPaused || recentUserInteraction;
            if (explicitUserPause) {
                try { video._bgUserPaused = true; } catch (e) { /* ignore */ }
            }
            setTimeout(function () {
                // Only fight background/system pauses, not an explicit user tap.
                if (realHidden && video.paused && !video.ended && !explicitUserPause && !video._bgUserPaused) {
                    resumeVideo(video);
                }
            }, 150);
        }, true);

        video.addEventListener('play', function () {
            try { video._bgUserPaused = false; } catch (e) { /* ignore */ }
            userPaused = false;
            recentUserInteraction = false;
            try { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing'; } catch (e) { /* ignore */ }
        }, true);
    }

    const observer = new MutationObserver((mutations) => {
        // Collect newly added videos once per batch to avoid repeated scans.
        const found = [];
        for (let i = 0; i < mutations.length; i++) {
            const nodes = mutations[i].addedNodes;
            for (let j = 0; j < nodes.length; j++) {
                const node = nodes[j];
                if (!node || node.nodeType !== 1) continue;
                if (node.tagName === 'VIDEO') {
                    found.push(node);
                } else if (typeof node.querySelectorAll === 'function') {
                    const videos = node.querySelectorAll('video');
                    for (let k = 0; k < videos.length; k++) found.push(videos[k]);
                }
            }
        }
        for (let i = 0; i < found.length; i++) setupVideo(found[i]);
    });

    const observeTarget = document.documentElement || document;
    observer.observe(observeTarget, { childList: true, subtree: true });

    // If we had to start on `document` because html wasn't ready, switch to
    // documentElement once available to narrow the observation scope.
    if (!document.documentElement) {
        const switchTarget = function () {
            try { observer.disconnect(); } catch (e) { /* ignore */ }
            if (document.documentElement) {
                try { observer.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
            } else {
                try { observer.observe(document, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', switchTarget, { once: true });
        } else {
            switchTarget();
        }
    }

    const scanExisting = () => {
        const videos = document.getElementsByTagName('video');
        for (let i = 0; i < videos.length; i++) {
            setupVideo(videos[i]);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scanExisting, { once: true });
    } else {
        scanExisting();
    }

})();
