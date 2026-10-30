// ==UserScript==
// @name         Background Playback Enabler
// @namespace    http://tampermonkey.net/
// @version      1.2
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
            setTimeout(function () {
                // Only fight background/system pauses, not an explicit user tap.
                if (realHidden && video.paused && !video.ended) {
                    resumeVideo(video);
                }
            }, 150);
        }, true);

        video.addEventListener('play', function () {
            try { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing'; } catch (e) { /* ignore */ }
        }, true);
    }

    const observer = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
            const nodes = mutations[i].addedNodes;
            for (let j = 0; j < nodes.length; j++) {
                const node = nodes[j];
                if (node.nodeType !== 1) continue;
                if (node.tagName === 'VIDEO') {
                    setupVideo(node);
                } else if (node.getElementsByTagName) {
                    const videos = node.getElementsByTagName('video');
                    for (let k = 0; k < videos.length; k++) {
                        setupVideo(videos[k]);
                    }
                }
            }
        }
    });

    const observeTarget = document.documentElement || document;
    observer.observe(observeTarget, { childList: true, subtree: true });

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
