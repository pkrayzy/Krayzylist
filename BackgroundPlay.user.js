// ==UserScript==
// @name         Background Playback Enabler
// @namespace    http://tampermonkey.net/
// @version      1.5
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

    var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    var _realHidden = false;
    var realVisibilityObservers = [];

    function findDocumentGetter(name) {
        try {
            var proto = document;
            while (proto) {
                var descriptor = Object.getOwnPropertyDescriptor(proto, name);
                if (descriptor && typeof descriptor.get === 'function') {
                    return descriptor.get;
                }
                proto = Object.getPrototypeOf(proto);
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    var nativeHiddenGetter = findDocumentGetter('hidden');

    function updateRealVisibility() {
        try {
            _realHidden = nativeHiddenGetter ? nativeHiddenGetter.call(document) : document.hidden;
        } catch (e) { /* ignore */ }
    }

    function observeRealVisibility(callback) {
        realVisibilityObservers.push(callback);
        return function () {
            var index = realVisibilityObservers.indexOf(callback);
            if (index !== -1) realVisibilityObservers.splice(index, 1);
        };
    }

    function onRealVisibilityChange(event) {
        updateRealVisibility();
        var observers = realVisibilityObservers.slice();
        for (var i = 0; i < observers.length; i++) {
            try { observers[i](); } catch (e) { /* ignore */ }
        }
        if (_realHidden && event && typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }
    }

    updateRealVisibility();
    document.addEventListener('visibilitychange', onRealVisibilityChange, true);

    // Background recovery (macOS)
    function backgroundRecoveryStep(config, state, event) {
        var op = event.op, t = event.t;
        var asked = op === 'stop' || (op === 'pauseCommand' && state.hidden);
        var inWindow = t <= state.hiddenAt + config.window;
        var pausedJustBefore = state.pauseSeen && t <= state.pausedAt + config.lead;
        var arming = op === 'hide' && config.enabled && (state.playing || pausedJustBefore);
        var lostWhileHidden = op === 'pause' && state.hidden && !state.intent && inWindow && state.retries < config.budget;
        var resumeNow = op === 'tick' && state.pending && state.hidden && state.retries < config.budget && inWindow;
        var retries = op === 'hide' ? 0 : resumeNow ? state.retries + 1 : state.retries;
        var pending = state.pending;
        if (op === 'hide') pending = arming && !state.playing;
        else if (op === 'show' || op === 'play' || asked || op === 'reset') pending = false;
        else if (op === 'pause') pending = state.armed && lostWhileHidden;
        else if (op === 'tick') pending = resumeNow && retries < config.budget && inWindow;
        return {
            hidden: op === 'hide' ? true : op === 'show' ? false : state.hidden,
            playing: op === 'play' ? true : op === 'pause' || op === 'reset' ? false : state.playing,
            armed: op === 'hide' ? arming : op === 'show' || asked || op === 'reset' ? false : state.armed,
            pending: pending,
            intent: op === 'hide' || op === 'play' ? false : asked ? true : state.intent,
            pauseSeen: op === 'pause' ? !state.intent : asked || op === 'reset' ? false : state.pauseSeen,
            retries: retries,
            hiddenAt: op === 'hide' ? t : state.hiddenAt,
            pausedAt: op === 'pause' && !state.intent ? t : state.pausedAt,
            resume: resumeNow
        };
    }

    var BACKGROUND_RECOVERY = { enabled: true, budget: 3, window: 6000, lead: 400 };
    var pauseIntentListeners = [];

    (function patchMediaSessionIntent() {
        try {
            var proto = typeof MediaSession !== 'undefined' && MediaSession.prototype;
            var original = proto && proto.setActionHandler;
            if (!original || original._wblockTubeCleaner) return;
            var patched = function (action, handler) {
                if ((action === 'pause' || action === 'stop') && typeof handler === 'function') {
                    var inner = handler;
                    handler = function () {
                        pauseIntentListeners.slice().forEach(function (listener) { try { listener(action); } catch (e) { /* ignore */ } });
                        return inner.apply(this, arguments);
                    };
                }
                return original.call(this, action, handler);
            };
            patched._wblockTubeCleaner = true;
            proto.setActionHandler = patched;
        } catch (e) { /* ignore */ }
    })();

    function setupBackgroundRecovery(video, resumePlayback) {
        var state = { hidden: _realHidden, playing: !video.paused && !video.ended, armed: false, pending: false,
            intent: false, pauseSeen: false, retries: 0, hiddenAt: 0, pausedAt: 0, resume: false };
        var timer = null;
        function now() { return Math.round(typeof performance !== 'undefined' ? performance.now() : Date.now()); }
        function send(op) {
            state = backgroundRecoveryStep(BACKGROUND_RECOVERY, state, { op: op, t: now() });
            if (state.resume) {
                try { resumePlayback(); } catch (e) { /* the next tick retries */ }
            }
            if (state.pending && timer === null) {
                timer = setTimeout(function () { timer = null; send('tick'); }, 300);
            } else if (!state.pending && timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
        }
        function onPlay() { send('play'); }
        function onPause() { send('pause'); }
        function onReset() { send('reset'); }
        function onIntent(action) { send(action === 'stop' ? 'stop' : 'pauseCommand'); }
        var stopVisibility = observeRealVisibility(function () { send(_realHidden ? 'hide' : 'show'); });
        video.addEventListener('playing', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onReset);
        video.addEventListener('emptied', onReset);
        pauseIntentListeners.push(onIntent);
        return function () {
            stopVisibility();
            video.removeEventListener('playing', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onReset);
            video.removeEventListener('emptied', onReset);
            var index = pauseIntentListeners.indexOf(onIntent);
            if (index !== -1) pauseIntentListeners.splice(index, 1);
            if (timer !== null) clearTimeout(timer);
            timer = null;
        };
    }

    // Background resume (iOS)
    function backgroundResumeStep(config, state, event) {
        var op = event.op, t = event.t;
        var system = op === 'pause' && config.enabled && !event.ended && !(t < state.pageAt + config.callGrace) &&
            !(t < state.inputAt + config.inputGrace) && !state.intent;
        var holding = system && !state.hidden;
        var clears = op === 'hide' || op === 'show' || op === 'play' || op === 'command' || op === 'input' || op === 'pageCall';
        return {
            hidden: op === 'hide' ? true : op === 'show' ? false : state.hidden,
            hiddenAt: op === 'hide' ? t : state.hiddenAt,
            pageAt: op === 'pageCall' ? t : state.pageAt,
            inputAt: op === 'input' ? t : state.inputAt,
            intent: op === 'command' ? true : op === 'play' ? false : state.intent,
            held: op === 'pause' ? holding : clears ? false : state.held,
            heldAt: holding ? t : state.heldAt,
            resume: system && state.hidden && t <= state.hiddenAt + config.window ||
                op === 'hide' && config.enabled && state.held && !state.intent && t <= state.heldAt + config.lead
        };
    }

    var BACKGROUND_RESUME = { enabled: true, callGrace: 100, inputGrace: 1000, lead: 1200, window: 1000 };
    var pagePauseListeners = [];

    if (IS_IOS) {
        (function patchPagePause() {
            try {
                var nativePause = HTMLMediaElement.prototype.pause;
                if (!nativePause || nativePause._wblockTubeCleaner) return;
                var patched = function () {
                    pagePauseListeners.slice().forEach(function (listener) { try { listener(this); } catch (e) { /* ignore */ } }, this);
                    return nativePause.apply(this, arguments);
                };
                patched._wblockTubeCleaner = true;
                HTMLMediaElement.prototype.pause = patched;
            } catch (e) { /* ignore */ }
        })();
    }

    function setupBackgroundResume(video) {
        if (!IS_IOS) return function () {};
        var state = { hidden: _realHidden, hiddenAt: 0, pageAt: 0, inputAt: 0, intent: false, held: false, heldAt: 0, resume: false };
        function now() { return Math.round(performance.now()); }
        function send(op, ended) {
            state = backgroundResumeStep(BACKGROUND_RESUME, state, { op: op, t: now(), ended: !!ended });
            if (!state.resume) return;
            var request = video.play();
            if (request && request.catch) request.catch(function (e) { /* ignore */ });
        }
        var inputs = ['pointerup', 'touchend', 'click', 'keydown'];
        function onInput() { send('input'); }
        function onPagePause(element) { if (element === video) send('pageCall'); }
        function onPause() { send('pause', video.ended); }
        function onPlay() { send('play'); }
        function onIntent() { send('command'); }
        var stopVisibility = observeRealVisibility(function () { send(_realHidden ? 'hide' : 'show'); });
        inputs.forEach(function (name) { window.addEventListener(name, onInput, true); });
        video.addEventListener('pause', onPause);
        video.addEventListener('playing', onPlay);
        pagePauseListeners.push(onPagePause);
        pauseIntentListeners.push(onIntent);
        return function () {
            stopVisibility();
            inputs.forEach(function (name) { window.removeEventListener(name, onInput, true); });
            video.removeEventListener('pause', onPause);
            video.removeEventListener('playing', onPlay);
            [pagePauseListeners, pauseIntentListeners].forEach(function (list) {
                var index = list.indexOf(list === pagePauseListeners ? onPagePause : onIntent);
                if (index !== -1) list.splice(index, 1);
            });
        };
    }

    function enableBackgroundPlayback() {
        try {
            Object.defineProperty(document, 'hidden', { get: function () { return false; }, configurable: true });
            Object.defineProperty(document, 'visibilityState', { get: function () { return 'visible'; }, configurable: true });
            Object.defineProperty(document, 'webkitHidden', { get: function () { return false; }, configurable: true });
            Object.defineProperty(document, 'webkitVisibilityState', { get: function () { return 'visible'; }, configurable: true });
        } catch (e) { /* ignore */ }
    }

    // Core: Watch for video element and apply enhancements
    var activeVideo = null;
    var playerObserver = null;
    var activeCleanups = [];

    function transformPlayer() {
        var player = document.getElementById('movie_player') || document.querySelector('video')?.closest('#movie_player') || document.querySelector('video')?.closest('ytd-player');
        if (!player) return;
        var video = player.querySelector('video') || (player.tagName === 'VIDEO' ? player : null);
        if (!video || video === activeVideo) return;

        // Cleanup old video
        activeCleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
        activeCleanups = [];
        activeVideo = video;

        // Apply enhancements
        enableBackgroundPlayback();
        activeCleanups.push(setupBackgroundRecovery(video, function () {
            if (typeof player.playVideo === 'function') player.playVideo();
            else video.play().catch(function () {});
        }));
        activeCleanups.push(setupBackgroundResume(video));
    }

    function observePlayer() {
        if (typeof MutationObserver !== 'undefined') {
            playerObserver = new MutationObserver(transformPlayer);
            playerObserver.observe(document.documentElement, { childList: true, subtree: true });
        }
        transformPlayer();
    }

    observePlayer();

})();
