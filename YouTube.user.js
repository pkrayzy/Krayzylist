// ==UserScript==
// @name         YouTube Enhancements & Bypasses
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Combined YouTube modifications for playback, ad-blocking, and player fixes
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

    // 1. Abnormality Detection Bypass
    (() => {
        const handler = {
            apply: (target, thisArg, args) => {
                const callback = args[0];
                if (typeof callback === 'function' && callback.toString().includes('onAbnormalityDetected')) {
                    args[0] = function() {};
                }
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.Promise.prototype.then = new Proxy(window.Promise.prototype.then, handler);
    })();

    // 2. IFrame Fetch Proxy
    (() => {
        const handler = {
            apply: (target, thisArg, args) => {
                const element = Reflect.apply(target, thisArg, args);
                try {
                    if (element instanceof HTMLIFrameElement && element.src === 'about:blank' && element.contentWindow) {
                        element.contentWindow.fetch = window.fetch;
                        element.contentWindow.Request = window.Request;
                    }
                } catch (e) {}
                return element;
            }
        };
        Node.prototype.appendChild = new Proxy(Node.prototype.appendChild, handler);
    })();

    // 3. SSAP Entity ID / Loop Fix
    (() => {
        let currentHref = document.location.href;
        let entities = [];
        let entityIds = [];
        let lastIdString = "";
        let isTracking = false;
        const originalPush = Array.prototype.push;

        const handler = {
            apply: (target, thisArg, args) => {
                const item = args[0];
                if (window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id &&
                    item && item !== window &&
                    typeof item.start === 'number' && item.end &&
                    item.namespace === 'ssap' && item.id) {

                    if (!isTracking || item.start !== 0 || entityIds.includes(item.id)) {
                        // Continue tracking
                    } else {
                        entities.length = 0;
                        entityIds.length = 0;
                        isTracking = true;
                        originalPush.call(entities, item);
                        originalPush.call(entityIds, item.id);
                    }

                    if (isTracking && item.start !== 0 && !entityIds.includes(item.id)) {
                        originalPush.call(entities, item);
                        originalPush.call(entityIds, item.id);
                    }
                }
                return Reflect.apply(target, thisArg, args);
            }
        };

        window.Array.prototype.push = new Proxy(window.Array.prototype.push, handler);

        document.addEventListener("DOMContentLoaded", () => {
            if (!window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id) return;

            const checkLoop = () => {
                const video = document.querySelector("video");
                if (video && entities.length) {
                    const duration = Math.round(video.duration);
                    const lastEnd = Math.round(entities.at(-1).end / 1000);
                    const idString = entityIds.join(",");

                    if ((video.loop === false && lastIdString !== idString && duration && duration === lastEnd) ||
                        (video.loop === true && duration && duration === lastEnd)) {
                        const startTime = entities.at(-1).start / 1000;
                        if (video.currentTime < startTime) {
                            video.currentTime = startTime;
                            isTracking = false;
                            lastIdString = idString;
                        }
                    }
                }
            };

            checkLoop();
            new MutationObserver(() => {
                if (currentHref !== document.location.href) {
                    currentHref = document.location.href;
                    entities.length = 0;
                    entityIds.length = 0;
                    isTracking = false;
                }
                checkLoop();
            }).observe(document, { childList: true, subtree: true });
        });
    })();

    // 4. Playback Context & Params Modifier (Web)
    (() => {
        const PYV = "pyv", PARAM_FIRST = "param_first", PARAM_SECOND = "param_second",
              CLIENT_SCREEN = "client_screen", AD_TYPE = "ad_type", NONE = "none",
              VAL_FIRST = "eAFgAQ", VAL_SECOND = "8AUB", VAL_YAHI = "YAHI", VAL_CHANNEL = "CHANNEL";

        let currentMode = PARAM_FIRST;
        let currentVideoId = null;
        const originalVisibilityState = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");

        const setVisible = () => {
            try {
                Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
            } catch (e) {}
        };

        const stringify = window.JSON.stringify;
        const setMode = (mode) => { currentMode = mode; };

        if (!(() => {
            try {
                const desc = Object.getOwnPropertyDescriptor(window.JSON, "parse");
                return !!desc && desc.writable;
            } catch (e) { return false; }
        })()) {
            const replaceHandler = {
                apply: (target, thisArg, args) => {
                    try {
                        let str = args[0];
                        if (str?.includes('"minimumPlaybackRate":100,"maximumPlaybackRate":100')) {
                            args[0] = str.replace('"minimumPlaybackRate":100,"maximumPlaybackRate":100', '"minimumPlaybackRate":25,"maximumPlaybackRate":200');
                        }
                    } catch (e) {}
                    return Reflect.apply(target, thisArg, args);
                }
            };
            window.String.prototype.replace = new Proxy(window.String.prototype.replace, replaceHandler);
        }

        setMode(CLIENT_SCREEN);

        const cleanInstallData = (obj) => {
            if (obj.playbackContext || obj.playerRequest) {
                delete obj.context?.client?.configInfo?.appInstallData;
            }
        };

        const modifyContext = (obj, context, mode) => {
            try {
                if (!obj || !context || !mode) return;

                const vId = obj.videoId;
                if (vId) {
                    if (currentVideoId && currentVideoId !== vId) setMode(PARAM_FIRST);
                    currentVideoId = vId;
                }

                const status = document.getElementById("movie_player")?.getPlayerResponse()?.playabilityStatus?.status;
                if (status !== "LOGIN_REQUIRED" && status !== "CONTENT_CHECK_REQUIRED") {
                    // Valid state
                } else {
                    mode = NONE;
                }

                if (mode === PARAM_FIRST && obj.context?.client?.clientScreen !== VAL_CHANNEL && !obj.params?.startsWith(VAL_YAHI)) {
                    obj.params = VAL_FIRST;
                    if (obj.playerRequest && obj.playerRequest.params !== VAL_FIRST) obj.playerRequest.params = VAL_FIRST;
                    if (obj.playbackContext && obj.playbackContext.params !== VAL_FIRST) obj.playbackContext.params = VAL_FIRST;
                    context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    setVisible();
                    cleanInstallData(obj);
                    return;
                }

                if (mode === PARAM_SECOND && obj.context?.client?.clientScreen !== VAL_CHANNEL && !obj.params?.startsWith(VAL_YAHI)) {
                    if (obj.params !== VAL_SECOND) obj.params = VAL_SECOND;
                    if (obj.playerRequest && obj.playerRequest.params !== VAL_SECOND) obj.playerRequest.params = VAL_SECOND;
                    if (obj.playbackContext && obj.playbackContext.params !== VAL_SECOND) obj.playbackContext.params = VAL_SECOND;
                    if (!obj.playlistId) obj.context.client.clientScreen = VAL_CHANNEL;
                    context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    setVisible();
                    cleanInstallData(obj);
                    return;
                }

                if (!(mode !== PYV || obj.context?.client?.clientScreen === VAL_CHANNEL || context.params?.startsWith(VAL_FIRST) && context.params?.startsWith(VAL_SECOND))) {
                    context.adPlaybackContext = { pyv: true };
                    context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    cleanInstallData(obj);
                    return;
                }

                if (mode === CLIENT_SCREEN && obj.context?.client?.clientName === "WEB") {
                    obj.context.client.clientScreen = VAL_CHANNEL;
                    context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    setVisible();
                    cleanInstallData(obj);
                    return;
                }

                if (mode === AD_TYPE) {
                    context.adPlaybackContext = { adType: "AD_TYPE_INSTREAM" };
                    context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    setVisible();
                    cleanInstallData(obj);
                    return;
                }

                if (mode === NONE) {
                    delete context.adPlaybackContext;
                    try { Object.defineProperty(document, "visibilityState", originalVisibilityState); } catch (e) {}
                }
            } catch (e) {}
        };

        const ERROR_MARKERS = ["playerErrorMessageRenderer", "UNPLAYABLE"];
        const parseHandler = {
            apply: (target, thisArg, args) => {
                if (location.href.includes("/shorts/") || location.href.includes("youtube.com/tv") || location.href.includes("youtube.com/embed/") || currentMode === NONE) {
                    return Reflect.apply(target, thisArg, args);
                }
                let result;
                try {
                    result = Reflect.apply(target, thisArg, args);
                    if (!result.responseContext && !result.playabilityStatus) return result;

                    const jsonStr = stringify(result);
                    if (ERROR_MARKERS.some(marker => jsonStr.includes(marker)) && !jsonStr.includes("CONTENT_CHECK_REQUIRED")) {
                        if (currentMode === PARAM_FIRST) { setMode(PARAM_SECOND); return result; }
                        if (currentMode === PARAM_SECOND) { setMode(PYV); return result; }
                        if (currentMode === PYV) { setMode(CLIENT_SCREEN); return result; }
                        if (currentMode === CLIENT_SCREEN) { setMode(AD_TYPE); return result; }
                        setMode(NONE);
                        return result;
                    }

                    if (currentMode === PARAM_FIRST && result.playerConfig?.audioConfig?.muteOnStart && (location.href.includes("/watch") || result.cards && !result.playabilityStatus?.miniplayer)) {
                        delete result.playerConfig.audioConfig.muteOnStart;
                        if (result.messages?.[0]?.youThereRenderer) delete result.messages[0].youThereRenderer;
                    }
                    if (currentMode === AD_TYPE && result.playerConfig?.granularVariableSpeedConfig) {
                        result.playerConfig.granularVariableSpeedConfig.maximumPlaybackRate = 200;
                        result.playerConfig.granularVariableSpeedConfig.minimumPlaybackRate = 25;
                    }
                    return result;
                } catch (e) {}
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.JSON.parse = new Proxy(window.JSON.parse, parseHandler);

        const encodeHandler = {
            apply: (target, thisArg, args) => {
                if (location.href.includes("/shorts/") || location.href.includes("youtube.com/tv") || location.href.includes("youtube.com/embed/")) {
                    return Reflect.apply(target, thisArg, args);
                }
                try {
                    let data = args[0];
                    if (data && (data.includes('"contentPlaybackContext"') || data.includes('"adSignalsInfo"'))) {
                        const obj = JSON.parse(data);
                        if (!obj.context?.client) return Reflect.apply(target, thisArg, args);
                        if (obj.playbackContext) modifyContext(obj, obj.playbackContext, currentMode);
                        if (obj.playerRequest) modifyContext(obj, obj.playerRequest.playbackContext, currentMode);
                        args[0] = stringify(obj);
                    }
                } catch (e) {}
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.TextEncoder.prototype.encode = new Proxy(window.TextEncoder.prototype.encode, encodeHandler);

        const stringifyHandler = {
            apply: (target, thisArg, args) => {
                if (location.href.includes("/shorts/") || location.href.includes("youtube.com/tv") || location.href.includes("youtube.com/embed/")) {
                    return Reflect.apply(target, thisArg, args);
                }
                try {
                    const obj = args[0];
                    if (!obj?.context?.client) return Reflect.apply(target, thisArg, args);
                    if (obj.playbackContext && obj.playbackContext.adPlaybackContext === undefined) {
                        modifyContext(obj, obj.playbackContext, currentMode);
                    }
                    if (obj.playerRequest && obj.playerRequest.playbackContext?.adPlaybackContext === undefined) {
                        modifyContext(obj, obj.playerRequest.playbackContext, currentMode);
                    }
                    args[0] = obj;
                } catch (e) {}
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.JSON.stringify = new Proxy(window.JSON.stringify, stringifyHandler);

        const requestHandler = {
            construct: (target, args, newTarget) => {
                try {
                    const url = args[0];
                    let body = args[1]?.body;
                    if (!url?.includes("youtubei") || location.href.includes("/shorts/") || location.href.includes("youtube.com/tv") || location.href.includes("youtube.com/embed/") || !body) {
                        return Reflect.construct(target, args, newTarget);
                    }
                    if (body.includes('"contentPlaybackContext"') || body.includes('"adSignalsInfo"')) {
                        const obj = JSON.parse(body);
                        if (!obj.context?.client) return Reflect.construct(target, args, newTarget);
                        if (obj.playbackContext) modifyContext(obj, obj.playbackContext, currentMode);
                        if (obj.playerRequest) modifyContext(obj, obj.playerRequest.playbackContext, currentMode);
                        args[1].body = stringify(obj);
                    }
                } catch (e) {}
                return Reflect.construct(target, args, newTarget);
            }
        };
        window.Request = new Proxy(window.Request, requestHandler);
    })();

    // 5. Playability Error Fixer & Mutation Observer
    (() => {
        const PLAYER_ID = "movie_player",
              PLAYER_UNAVAILABLE_SELECTOR = "ytd-watch-flexy[player-unavailable]",
              ERROR_SELECTOR = `#${PLAYER_ID} > .ytp-error`,
              ERROR_SCREEN_SELECTOR = "yt-playability-error-supported-renderers#error-screen:has(>*)",
              SUPPORT_LINK_SELECTOR = 'yt-playability-error-supported-renderers#error-screen a[href^="//support.google.com/youtube/answer/2802245"]',
              LOGIN_REQUIRED = "LOGIN_REQUIRED",
              CONTENT_CHECK_REQUIRED = "CONTENT_CHECK_REQUIRED",
              PYV = "pyv", PARAM_FIRST = "param_first", PARAM_SECOND = "param_second",
              CLIENT_SCREEN = "client_screen", AD_TYPE = "ad_type", NONE = "none",
              VAL_FIRST = "eAFgAQ", VAL_SECOND = "8AUB", VAL_YAHI = "YAHI", VAL_CHANNEL = "CHANNEL";

        let currentMode = PARAM_FIRST;
        let currentVideoId = null;
        const seenVideos = new Set();

        const getVideoData = () => {
            const player = document.getElementById(PLAYER_ID);
            const searchParams = new URLSearchParams(window.location.search);
            const videoId = searchParams.get("v") || player?.getVideoData?.().video_id;
            const timeInSeconds = searchParams.get("t") ?? "0";
            return { videoId, timeInSeconds: parseInt(timeInSeconds, 10) };
        };

        const reloadVideo = () => {
            updateUI();
            const player = document.getElementById(PLAYER_ID);
            if (player && typeof player.loadVideoById === 'function') {
                try {
                    const { videoId, timeInSeconds } = getVideoData();
                    player.loadVideoById(videoId, timeInSeconds);
                } catch (e) {}
            }
        };

        const createErrorTracker = () => {
            let lastId = null, lastSelector = null, count = 0;
            return (selector) => {
                try {
                    if (!selector) return false;
                    const { videoId } = getVideoData();
                    if (!videoId) return false;
                    if (lastId === videoId && lastSelector === selector) {
                        count++;
                    } else {
                        lastId = videoId;
                        lastSelector = selector;
                        count = 1;
                    }
                    if (count >= 2) {
                        count = 0;
                        return true;
                    }
                    return false;
                } catch (e) { return false; }
            };
        };

        const setMode = (mode) => { currentMode = mode; };
        const originalVisibilityState = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");

        const setVisible = () => {
            try {
                Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
            } catch (e) {}
        };

        const updateUI = () => {
            const player = document.getElementById(PLAYER_ID);
            const errorScreen = document.querySelector(ERROR_SCREEN_SELECTOR);
            const miniplayerError = document.querySelector("yt-playability-error-supported-renderers.ytdMiniplayerPlayerContainerPlayabilityError:has(>*)");
            const unavailablePlayer = document.querySelector(PLAYER_UNAVAILABLE_SELECTOR);
            const supportLink = document.querySelector(SUPPORT_LINK_SELECTOR);

            if (!player || supportLink) return;

            const response = player.getPlayerResponse?.();
            const status = response?.playabilityStatus?.status;

            if (status !== LOGIN_REQUIRED && status !== CONTENT_CHECK_REQUIRED) {
                if (unavailablePlayer || miniplayerError) {
                    if (errorScreen) errorScreen.style.setProperty("display", "none", "important");
                    if (miniplayerError) miniplayerError.style.setProperty("display", "none", "important");
                    if (unavailablePlayer) unavailablePlayer.removeAttribute("player-unavailable");
                }
            } else {
                if (errorScreen) errorScreen.style.setProperty("display", "block", "important");
            }
        };

        const cleanInstallData = (obj) => {
            if (obj.playbackContext || obj.playerRequest) {
                delete obj.context?.client?.configInfo?.appInstallData;
            }
        };

        const modifyContext = (obj, context, mode) => {
            try {
                if (!obj || !context || !mode) return;

                const vId = obj.videoId;
                if (vId) {
                    if (currentVideoId && currentVideoId !== vId) setMode(PARAM_FIRST);
                    currentVideoId = vId;
                }

                if (mode === PARAM_FIRST && obj.context?.client?.clientScreen !== VAL_CHANNEL && !obj.params?.startsWith(VAL_YAHI)) {
                    obj.params = VAL_FIRST;
                    if (obj.playerRequest && obj.playerRequest.params !== VAL_FIRST) obj.playerRequest.params = VAL_FIRST;
                    if (obj.playbackContext && obj.playbackContext.params !== VAL_FIRST) obj.playbackContext.params = VAL_FIRST;
                    context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    setVisible();
                    cleanInstallData(obj);
                    return;
                }

                if (mode === PARAM_SECOND && obj.context?.client?.clientScreen !== VAL_CHANNEL && !obj.params?.startsWith(VAL_YAHI)) {
                    if (obj.params !== VAL_SECOND) obj.params = VAL_SECOND;
                    if (obj.playerRequest && obj.playerRequest.params !== VAL_SECOND) obj.playerRequest.params = VAL_SECOND;
                    if (obj.playbackContext && obj.playbackContext.params !== VAL_SECOND) obj.playbackContext.params = VAL_SECOND;
                    if (!obj.playlistId) obj.context.client.clientScreen = VAL_CHANNEL;
                    context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    setVisible();
                    cleanInstallData(obj);
                    return;
                }

                if (!(mode !== PYV || obj.context?.client?.clientScreen === VAL_CHANNEL || context.params?.startsWith(VAL_FIRST) && context.params?.startsWith(VAL_SECOND))) {
                    context.adPlaybackContext = { pyv: true };
                    context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    setVisible();
                    cleanInstallData(obj);
                    return;
                }

                if (mode === CLIENT_SCREEN && obj.context?.client?.clientName === "WEB") {
                    obj.context.client.clientScreen = VAL_CHANNEL;
                    context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    setVisible();
                    cleanInstallData(obj);
                    return;
                }

                if (mode === AD_TYPE) {
                    context.adPlaybackContext = { adType: "AD_TYPE_INSTREAM" };
                    context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    setVisible();
                    cleanInstallData(obj);
                    return;
                }

                if (mode === NONE) {
                    delete context.adPlaybackContext;
                    try { Object.defineProperty(document, "visibilityState", originalVisibilityState); } catch (e) {}
                }
            } catch (e) {}
        };

        const xhrHandler = {
            apply: (target, thisArg, args) => {
                try {
                    let data = args[0];
                    if (!data || location.href.includes("youtube.com/tv") || location.href.includes("youtube.com/embed/")) {
                        return Reflect.apply(target, thisArg, args);
                    }
                    const isArray = Array.isArray(data);
                    const value = isArray ? data[0] : data;
                    if (typeof value !== 'string') return Reflect.apply(target, thisArg, args);
                    if (!value.includes('"contentPlaybackContext"') && !value.includes('"adSignalsInfo"')) {
                        return Reflect.apply(target, thisArg, args);
                    }
                    const obj = JSON.parse(value);
                    if (!obj.context?.client) return Reflect.apply(target, thisArg, args);
                    if (obj.playbackContext) modifyContext(obj, obj.playbackContext, currentMode);
                    if (obj.playerRequest) modifyContext(obj, obj.playerRequest.playbackContext, currentMode);
                    const result = JSON.stringify(obj);
                    if (isArray) args[0][0] = result; else args[0] = result;
                } catch (e) {}
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.XMLHttpRequest.prototype.send = new Proxy(window.XMLHttpRequest.prototype.send, xhrHandler);

        let errorTracker = createErrorTracker();
        const root = document.documentElement;

        new MutationObserver(() => {
            if (document.querySelector(ERROR_SCREEN_SELECTOR)) updateUI();

            const player = document.getElementById(PLAYER_ID);
            const errorScreen = document.querySelector(ERROR_SCREEN_SELECTOR);
            const unavailablePlayer = document.querySelector(PLAYER_UNAVAILABLE_SELECTOR);
            const supportLink = document.querySelector(SUPPORT_LINK_SELECTOR);
            const miniplayerError = document.querySelector("yt-playability-error-supported-renderers.ytdMiniplayerPlayerContainerPlayabilityError:has(>*)");

            if (!player || supportLink) return;

            const response = player.getPlayerResponse?.();
            if (response?.playabilityStatus?.status === LOGIN_REQUIRED || response?.playabilityStatus?.status === CONTENT_CHECK_REQUIRED) return;

            const videoData = player.getVideoData?.();
            const hasError = (errorScreen || unavailablePlayer || miniplayerError) && videoData?.errorCode != null;
            if (!hasError) return;

            const { videoId } = getVideoData();
            if (videoId) {
                for (const id of seenVideos) {
                    if (id !== videoId) seenVideos.delete(id);
                }
            }

            if (currentMode === PARAM_FIRST) {
                if (!errorTracker(unavailablePlayer)) {
                    reloadVideo();
                    setMode(PARAM_SECOND);
                    reloadVideo();
                }
            } else if (currentMode === PARAM_SECOND) {
                if (!errorTracker(errorScreen)) {
                    reloadVideo();
                    setMode(PYV);
                    reloadVideo();
                }
            } else if (currentMode === PYV) {
                if (!errorTracker(unavailablePlayer)) {
                    reloadVideo();
                    setMode(CLIENT_SCREEN);
                    reloadVideo();
                }
            } else if (currentMode === CLIENT_SCREEN) {
                if (!errorTracker(miniplayerError)) {
                    reloadVideo();
                    setMode(AD_TYPE);
                    reloadVideo();
                }
            } else if (currentMode === AD_TYPE) {
                if (!errorTracker(response)) {
                    reloadVideo();
                    setMode(NONE);
                    reloadVideo();
                }
            } else if (currentMode === NONE) {
                const { videoId } = getVideoData();
                if (!videoId || seenVideos.has(videoId)) {
                    updateUI();
                } else {
                    seenVideos.add(videoId);
                    reloadVideo();
                }
            }
        }).observe(root, { attributes: true, childList: true, subtree: true });
    })();

    // 6. Comprehensive Proxy-based Bypass (youtube-nocookie support)
    (() => {
        const MODES = ["param_first", "param_second", "pyv", "client_screen", "ad_type"];
        (() => {
            const PYV = "pyv", PARAM_FIRST = "param_first", PARAM_SECOND = "param_second",
                  CLIENT_SCREEN = "client_screen", AD_TYPE = "ad_type", NONE = "none",
                  VAL_FIRST = "eAFgAQ", VAL_SECOND = "8AUB", VAL_YAHI = "YAHI", VAL_CHANNEL = "CHANNEL";

            let currentMode = MODES[0] ?? NONE;
            let currentVideoId = null;
            let isChannelScreen = false;

            const isExcludedUrl = () => location.href.includes("/shorts/") || location.href.includes("youtube.com/tv");
            const originalVisibilityState = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");

            const setVisible = () => {
                try {
                    Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
                } catch (e) {}
            };

            const stringify = window.JSON.stringify;
            const setMode = (mode) => { currentMode = mode; };

            if (!(() => {
                try {
                    const desc = Object.getOwnPropertyDescriptor(window.JSON, "parse");
                    return !!desc && desc.writable;
                } catch (e) { return false; }
            })()) {
                const replaceHandler = {
                    apply: (target, thisArg, args) => {
                        try {
                            let str = args[0];
                            if (str?.includes('"minimumPlaybackRate":100,"maximumPlaybackRate":100')) {
                                args[0] = str.replace('"minimumPlaybackRate":100,"maximumPlaybackRate":100', '"minimumPlaybackRate":25,"maximumPlaybackRate":200');
                            }
                        } catch (e) {}
                        return Reflect.apply(target, thisArg, args);
                    }
                };
                window.String.prototype.replace = new Proxy(window.String.prototype.replace, replaceHandler);
            }

            setMode(CLIENT_SCREEN);

            const cleanInstallData = (obj) => {
                if (obj.playbackContext || obj.playerRequest) {
                    delete obj.context?.client?.configInfo?.appInstallData;
                }
            };

            const setChannelScreen = (obj) => {
                if (obj.context.client.clientScreen !== VAL_CHANNEL) {
                    isChannelScreen = true;
                    obj.context.client.clientScreen = VAL_CHANNEL;
                }
            };

            const modifyContext = (obj, context, mode) => {
                try {
                    if (!obj?.context?.client || !context || typeof context !== 'object' || !mode) return;

                    const status = document.getElementById("movie_player")?.getPlayerResponse?.()?.playabilityStatus?.status;
                    if (status !== "CONTENT_CHECK_REQUIRED" && new URLSearchParams(location.search).get("rco") !== "1") {
                        obj.racyCheckOk = true;
                        if (obj.playerRequest) obj.playerRequest.racyCheckOk = true;
                    }

                    const vId = obj.videoId || obj.playerRequest?.videoId;
                    if (vId) {
                        if (currentVideoId && currentVideoId !== vId) {
                            setMode(PARAM_FIRST);
                            isChannelScreen = false;
                        }
                        currentVideoId = vId;
                    }

                    mode = currentMode;
                    const contexts = [obj, obj.playerRequest, context];
                    if (obj.context.client.clientScreen === VAL_CHANNEL && contexts.some(c => c?.params === VAL_SECOND)) {
                        isChannelScreen = true;
                    }

                    for (const c of contexts) {
                        if (c?.params !== VAL_FIRST && c?.params !== VAL_SECOND) delete c.params;
                    }

                    const adCtx = context.adPlaybackContext;
                    if (adCtx?.pyv === true) delete adCtx.pyv;
                    if (adCtx?.adType === "AD_TYPE_INSTREAM") delete adCtx.adType;
                    if (adCtx && Object.keys(adCtx).length === 0) delete context.adPlaybackContext;

                    const isCustomScreen = obj.context.client.clientScreen !== VAL_CHANNEL || isChannelScreen;

                    if ((status === "LOGIN_REQUIRED" || (status === "CONTENT_CHECK_REQUIRED" && !obj.racyCheckOk)) && (mode = NONE)) {
                        // Handle none
                    }

                    if (mode === PARAM_FIRST && isCustomScreen && !obj.params?.startsWith(VAL_YAHI)) {
                        obj.params = VAL_FIRST;
                        context.params = VAL_FIRST;
                        if (obj.playerRequest && obj.playerRequest.params !== VAL_FIRST) obj.playerRequest.params = VAL_FIRST;
                        if (obj.playbackContext && obj.playbackContext.params !== VAL_FIRST) obj.playbackContext.params = VAL_FIRST;
                        if (context.contentPlaybackContext && typeof context.contentPlaybackContext === 'object') {
                            context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                        }
                        setVisible();
                        cleanInstallData(obj);
                        return;
                    }

                    if (mode === PARAM_SECOND && isCustomScreen && !obj.params?.startsWith(VAL_YAHI)) {
                        context.params = VAL_SECOND;
                        if (obj.params !== VAL_SECOND) obj.params = VAL_SECOND;
                        if (obj.playerRequest && obj.playerRequest.params !== VAL_SECOND) obj.playerRequest.params = VAL_SECOND;
                        if (obj.playbackContext && obj.playbackContext.params !== VAL_SECOND) obj.playbackContext.params = VAL_SECOND;
                        if (!obj.playlistId) setChannelScreen(obj);
                        if (context.contentPlaybackContext && typeof context.contentPlaybackContext === 'object') {
                            context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                        }
                        setVisible();
                        cleanInstallData(obj);
                        return;
                    }

                    if (mode === PYV && isCustomScreen && (!context.params?.startsWith(VAL_FIRST) && !context.params?.startsWith(VAL_SECOND))) {
                        context.adPlaybackContext = { ...context.adPlaybackContext, pyv: true };
                        if (context.contentPlaybackContext && typeof context.contentPlaybackContext === 'object') {
                            context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                        }
                        cleanInstallData(obj);
                        return;
                    }

                    if (mode === CLIENT_SCREEN && obj.context?.client?.clientName === "WEB") {
                        setChannelScreen(obj);
                        if (context.contentPlaybackContext && typeof context.contentPlaybackContext === 'object') {
                            context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                        }
                        setVisible();
                        cleanInstallData(obj);
                        return;
                    }

                    if (mode === AD_TYPE) {
                        context.adPlaybackContext = { ...context.adPlaybackContext, adType: "AD_TYPE_INSTREAM" };
                        if (context.contentPlaybackContext && typeof context.contentPlaybackContext === 'object') {
                            context.contentPlaybackContext.lactMilliseconds = String(Date.now());
                        }
                        setVisible();
                        cleanInstallData(obj);
                        return;
                    }

                    if (mode === NONE) {
                        try { Object.defineProperty(document, "visibilityState", originalVisibilityState); } catch (e) {}
                    }
                } catch (e) {}
            };

            const ERROR_MARKERS = ["playerErrorMessageRenderer", "UNPLAYABLE"];
            const parseHandler = {
                apply: (target, thisArg, args) => {
                    if (isExcludedUrl() || currentMode === NONE) return Reflect.apply(target, thisArg, args);
                    let result;
                    try {
                        result = Reflect.apply(target, thisArg, args);
                        if (!result.responseContext && !result.playabilityStatus) return result;

                        const jsonStr = stringify(result);
                        if (ERROR_MARKERS.some(marker => jsonStr.includes(marker)) && !jsonStr.includes("CONTENT_CHECK_REQUIRED")) {
                            const idx = MODES.indexOf(currentMode);
                            setMode(idx < 0 ? NONE : MODES[idx + 1] ?? NONE);
                            return result;
                        }

                        if (currentMode === PARAM_FIRST && result.playerConfig?.audioConfig?.muteOnStart && (location.href.includes("/watch") || result.cards && !result.playabilityStatus?.miniplayer)) {
                            delete result.playerConfig.audioConfig.muteOnStart;
                            if (result.messages?.[0]?.youThereRenderer) delete result.messages[0].youThereRenderer;
                        }
                        if (currentMode === AD_TYPE && result.playerConfig?.granularVariableSpeedConfig) {
                            result.playerConfig.granularVariableSpeedConfig.maximumPlaybackRate = 200;
                            result.playerConfig.granularVariableSpeedConfig.minimumPlaybackRate = 25;
                        }
                        return result;
                    } catch (e) {}
                    return Reflect.apply(target, thisArg, args);
                }
            };
            window.JSON.parse = new Proxy(window.JSON.parse, parseHandler);

            const encodeHandler = {
                apply: (target, thisArg, args) => {
                    if (isExcludedUrl()) return Reflect.apply(target, thisArg, args);
                    try {
                        let data = args[0];
                        if (data && (data.includes('"contentPlaybackContext"') || data.includes('"adSignalsInfo"'))) {
                            const obj = JSON.parse(data);
                            if (!obj.context?.client) return Reflect.apply(target, thisArg, args);
                            if (obj.playbackContext) modifyContext(obj, obj.playbackContext, currentMode);
                            if (obj.playerRequest) modifyContext(obj, obj.playerRequest.playbackContext, currentMode);
                            args[0] = stringify(obj);
                        }
                    } catch (e) {}
                    return Reflect.apply(target, thisArg, args);
                }
            };
            window.TextEncoder.prototype.encode = new Proxy(window.TextEncoder.prototype.encode, encodeHandler);

            const stringifyHandler = {
                apply: (target, thisArg, args) => {
                    if (isExcludedUrl()) return Reflect.apply(target, thisArg, args);
                    try {
                        const obj = args[0];
                        if (!obj?.context?.client) return Reflect.apply(target, thisArg, args);

                        const targets = [obj.playbackContext, obj.playerRequest?.playbackContext];
                        for (const t of targets) {
                            const adCtx = t?.adPlaybackContext;
                            if (!t || (adCtx && adCtx.pyv !== true && adCtx.adType !== "AD_TYPE_INSTREAM")) {
                                modifyContext(obj, t, currentMode);
                            }
                        }
                        args[0] = obj;
                    } catch (e) {}
                    return Reflect.apply(target, thisArg, args);
                }
            };
            window.JSON.stringify = new Proxy(window.JSON.stringify, stringifyHandler);

            const requestHandler = {
                construct: (target, args, newTarget) => {
                    try {
                        const url = args[0];
                        let body = args[1]?.body;
                        if (!url?.includes("youtubei") || isExcludedUrl() || !body) return Reflect.construct(target, args, newTarget);
                        if (body.includes('"contentPlaybackContext"') || body.includes('"adSignalsInfo"')) {
                            const obj = JSON.parse(body);
                            if (!obj.context?.client) return Reflect.construct(target, args, newTarget);
                            if (obj.playbackContext) modifyContext(obj, obj.playbackContext, currentMode);
                            if (obj.playerRequest) modifyContext(obj, obj.playerRequest.playbackContext, currentMode);
                            args[1].body = stringify(obj);
                        }
                    } catch (e) {}
                    return Reflect.construct(target, args, newTarget);
                }
            };
            window.Request = new Proxy(window.Request, requestHandler);
        })();
    })();

    // 7. Function.prototype.call Proxy / Video Loader
    (() => {
        const originalCall = Function.prototype.call;
        let hasRequest = false, isBackoff = false, isGlobalBackoff = false;

        const searchBackoff = (obj, maxDepth = 5) => {
            if (typeof obj !== 'object' || obj === null) return false;
            const stack = [ { obj, depth: 0 } ];
            const visited = new WeakSet();

            while (stack.length > 0 && !isGlobalBackoff) {
                const { obj: current, depth } = stack.pop();
                if (depth > maxDepth || typeof current !== 'object' || current === null || visited.has(current)) continue;

                visited.add(current);
                try {
                    if (Object.hasOwn(current, 'backoffTimeMs')) {
                        if (current.backoffTimeMs === undefined) {
                            isGlobalBackoff = true;
                            return false;
                        }
                        return true;
                    }
                } catch (e) {}

                for (const key in current) {
                    if (Object.hasOwn(current, key)) {
                        const val = current[key];
                        if (val !== null && typeof val === 'object' && !visited.has(val)) {
                            stack.push({ obj: val, depth: depth + 1 });
                        }
                    }
                }
            }
            return false;
        };

        const handler = {
            apply: (target, thisArg, args) => {
                const arg = args[0];
                if (arg?.requestNumber && arg?.snapshot) {
                    try {
                        isBackoff = searchBackoff(arg);
                        hasRequest = true;
                        if (isBackoff || isGlobalBackoff) {
                            Function.prototype.call = originalCall;
                        }
                    } catch (e) {}
                }
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.Function.prototype.call = new Proxy(window.Function.prototype.call, handler);

        window.addEventListener("DOMContentLoaded", async () => {
            if (Function.prototype.call === originalCall && !isBackoff && hasRequest) return;

            const searchParams = new URLSearchParams(window.location.search);
            const vId = searchParams.get("v");
            if (!vId) return;

            const player = await new Promise((resolve) => {
                const start = Date.now();
                const timeout = 10000;
                const poll = () => {
                    const el = document.querySelector("#movie_player");
                    if (el) resolve(el);
                    else if (Date.now() - start > timeout) resolve(null);
                    else setTimeout(poll, 200);
                };
                poll();
            });

            if (!player) return;
            const startTime = searchParams.get("t") ?? "0";
            const timeInSeconds = parseInt(startTime, 10);

            if (typeof player.loadVideoById === 'function') {
                try {
                    player.loadVideoById(vId, timeInSeconds);
                } catch (e) {}
            }
        });
    })();

    // 8. Promise.prototype.then / Player Response Cleaner
    (() => {
        const cleanResponse = {
            apply: (target, thisArg, args) => {
                const callback = args[0];
                if (typeof callback?.value === 'string' && callback.value.includes('playerResponse')) {
                    try {
                        let val = callback.value;
                        if ((location.href.includes('/watch') || val.includes('"cards"') && !val.includes('"miniplayer"')) && val.includes('"muteOnStart":true')) {
                            val = val.replace('"muteOnStart":true', '"muteOnStart":false');
                        }
                        if (val.includes('"youThereRenderer":')) {
                            val = val.replace('"youThereRenderer":', '"no_youThereRenderer":');
                        }
                        callback.value = val.replace(/"(adSlots|playerAds)":/g, '"no_ads":');
                        args[0] = callback;
                    } catch (e) {}
                }
                return Reflect.apply(target, thisArg, args);
            }
        };

        const thenHandler = {
            apply: (target, thisArg, args) => {
                const callback = args[0];
                if (typeof callback === 'function' && callback.toString().includes('.next(')) {
                    args[0] = new Proxy(callback, cleanResponse);
                }
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.Promise.prototype.then = new Proxy(window.Promise.prototype.then, thenHandler);
    })();

    // 9. responseContext Ad Cleaner
    (() => {
        const responseHandler = {
            apply: (target, thisArg, args) => {
                const result = Reflect.apply(target, thisArg, args);
                if (result?.responseContext) {
                    try {
                        delete result.adSlots;
                        delete result.playerAds;
                        if (result.playerConfig?.audioConfig?.muteOnStart && (location.href.includes('/watch') || result.cards && !result.playabilityStatus?.miniplayer)) {
                            delete result.playerConfig.audioConfig.muteOnStart;
                            if (result.messages?.[0]?.youThereRenderer) delete result.messages[0].youThereRenderer;
                        }
                    } catch (e) {}
                }
                return result;
            }
        };

        const thenHandler = {
            apply: (target, thisArg, args) => {
                const callback = args[0];
                if (typeof callback === 'function' && callback.toString().includes('jspbResponseCtor')) {
                    args[0] = new Proxy(callback, responseHandler);
                }
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.Promise.prototype.then = new Proxy(window.Promise.prototype.then, thenHandler);
    })();

    // 10. ytInitialData JSON Clone
    (() => {
        let cloned = false;
        const handler = {
            apply: (target, thisArg, args) => {
                try {
                    if (!cloned && window.ytInitialData) {
                        window.ytInitialData = JSON.parse(JSON.stringify(window.ytInitialData));
                        cloned = true;
                    }
                } catch (e) {}
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.Promise.prototype.then = new Proxy(window.Promise.prototype.then, handler);
    })();

    // 11. m.youtube.com lactMilliseconds Fix
    (() => {
        const handler = {
            apply: (target, thisArg, args) => {
                if (location.href.includes("/shorts/") || location.href.includes("youtube.com/tv") || location.href.includes("youtube.com/embed/")) {
                    return Reflect.apply(target, thisArg, args);
                }
                try {
                    const obj = args[0];
                    if (!obj?.context?.client) return Reflect.apply(target, thisArg, args);

                    const now = String(Date.now());
                    if (obj.playbackContext && obj.playbackContext.adPlaybackContext === undefined) {
                        obj.playbackContext.contentPlaybackContext.lactMilliseconds = now;
                    }
                    if (obj.playerRequest && obj.playerRequest.playbackContext?.adPlaybackContext === undefined) {
                        obj.playerRequest.playbackContext.contentPlaybackContext.lactMilliseconds = now;
                    }
                    args[0] = obj;
                } catch (e) {}
                return Reflect.apply(target, thisArg, args);
            }
        };
        window.JSON.stringify = new Proxy(window.JSON.stringify, handler);
    })();

})();
