// ==UserScript==
// @name         Tube Cleaner
// @namespace    com.skula.wblock
// @version      0.1.14
// @description  Gives YouTube Safari-native controls, chapters, subtitles, SponsorBlock, optional DeArrow branding, picture-in-picture, background playback, quality selection, and audio-only mode.
// @description:de  Bietet YouTube native Safari-Steuerelemente, Kapitel, Untertitel, SponsorBlock, optionales DeArrow-Branding, Bild-in-Bild, Hintergrundwiedergabe, Qualitätsauswahl und einen Nur-Audio-Modus.
// @description:es  Añade a YouTube controles nativos de Safari, capítulos, subtítulos, SponsorBlock, marcas opcionales de DeArrow, imagen en imagen, reproducción en segundo plano, selección de calidad y modo de solo audio.
// @description:fr  Ajoute à YouTube les commandes natives de Safari, les chapitres, les sous-titres, SponsorBlock, le branding DeArrow facultatif, l’image dans l’image, la lecture en arrière-plan, le choix de qualité et le mode audio seul.
// @description:it  Aggiunge a YouTube controlli nativi di Safari, capitoli, sottotitoli, SponsorBlock, branding DeArrow opzionale, picture-in-picture, riproduzione in background, selezione qualità e modalità solo audio.
// @description:pt-BR  Adiciona ao YouTube controles nativos do Safari, capítulos, legendas, SponsorBlock, identidade visual opcional do DeArrow, picture-in-picture, reprodução em segundo plano, seleção de qualidade e modo somente áudio.
// @description:ja  YouTubeにSafariネイティブのコントロール、チャプター、字幕、SponsorBlock、任意のDeArrow表示、ピクチャ・イン・ピクチャ、バックグラウンド再生、画質選択、音声のみモードを追加します。
// @description:ko  YouTube에 Safari 네이티브 컨트롤, 챕터, 자막, SponsorBlock, 선택적 DeArrow 브랜딩, PIP, 백그라운드 재생, 화질 선택 및 오디오 전용 모드를 추가합니다.
// @description:ru  Добавляет YouTube нативные элементы управления Safari, главы, субтитры, SponsorBlock, дополнительный брендинг DeArrow, картинку-в-картинке, фоновое воспроизведение, выбор качества и аудиорежим.
// @description:zh-Hans  为 YouTube 添加 Safari 原生控件、章节、字幕、SponsorBlock、可选的 DeArrow 品牌替换、画中画、后台播放、画质选择和纯音频模式。
// @author       wBlock
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://music.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @match        https://youtube-nocookie.com/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Embed iframes are a poster and YouTube's own play button in a box the
    // host page sizes. Nativeizing them hides that chrome and leaves a blank
    // frame, so leave youtube.com/embed and youtube-nocookie alone.
    try {
        var embedHost = location.hostname || '';
        var embedPath = location.pathname || '';
        var isNocookie = /(^|\.)youtube-nocookie\.com$/i.test(embedHost);
        var isEmbedPath = /^\/(?:embed|live_embed)(?:\/|$)/.test(embedPath) ||
            /^\/shorts\/[^/]+\/embed(?:\/|$)/.test(embedPath);
        if (isNocookie || isEmbedPath) { return; }
    } catch (e) { /* continue on a regular watch page */ }

    // ------------------------------------------------------------------
    // Tube Cleaner v4.5.0
    //
    // Vinegar Extract approach: instead of trying to extract stream URLs
    // from the player response (which 403 due to SABR), we let YouTube's
    // player create and initialize the <video> element with its SABR/MSE
    // pipeline, then we repurpose that <video> element into a native
    // Safari player.
    //
    // How it works:
    //   1. Wait for YouTube's player to create a <video> element
    //   2. Detach it from YouTube's player container
    //   3. Insert it into a minimal native wrapper
    //   4. Enable Safari's native controls
    //   5. Hide YouTube's player chrome via CSS
    //   6. Ad blocking is handled by wBlock's content blocker
    //
    // This preserves full quality (SABR adaptive bitrate) while giving
    // the user a native Safari video experience.
    // ------------------------------------------------------------------

    var LOG_PREFIX = '[Tube Cleaner]';
    var STORAGE_AUDIO = 'wblock.tubeCleaner.audioOnly';
    var STORAGE_QUALITY = 'wblock.tubeCleaner.quality';
    var STORAGE_POSITION = 'wblock.tubeCleaner.position.';
    var ATTR_CLEANED = 'data-wblock-tc-cleaned';

    var debug = !!window.__wblockTubeCleanerDebug;

    function log() {
        if (!debug) return;
        try { console.log.apply(console, [LOG_PREFIX].concat([].slice.call(arguments))); }
        catch (e) { /* ignore */ }
    }

    function warn() {
        try { console.warn.apply(console, [LOG_PREFIX].concat([].slice.call(arguments))); }
        catch (e) { /* ignore */ }
    }

    // ------------------------------------------------------------------
    // iOS / iPadOS detection
    // ------------------------------------------------------------------

    // iPadOS requesting the desktop site reports "MacIntel" with touch support.
    // Real Macs report zero maxTouchPoints in Safari. Do not inspect
    // documentElement here: production injection can run before <html> exists.
    var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    // ------------------------------------------------------------------
    // Auto PiP
    // ------------------------------------------------------------------

    var AUTO_PIP_KEY = 'wblock.tubeCleaner.autoPiP';
    var autoPiPEnabled = false;
    var pipActive = false;

    function getAutoPiP() {
        try {
            var stored = localStorage.getItem(AUTO_PIP_KEY);
            return stored === null ? true : stored === '1';
        } catch (e) { return true; }
    }

    function setAutoPiP(v) {
        try { localStorage.setItem(AUTO_PIP_KEY, v ? '1' : '0'); } catch (e) { /* ignore */ }
        autoPiPEnabled = v;
    }

    try { autoPiPEnabled = getAutoPiP(); } catch (e) { /* ignore */ }

    function supportsWebkitPiP(video) {
        try {
            return !!(video && typeof video.webkitSupportsPresentationMode === 'function' &&
                video.webkitSupportsPresentationMode('picture-in-picture'));
        } catch (e) { return false; }
    }

    function isPiPActive(video) {
        return document.pictureInPictureElement === video ||
            (video && video.webkitPresentationMode === 'picture-in-picture');
    }

    function enterPiP(video) {
        if (!video || !autoPiPEnabled) return;
        if (isPiPActive(video)) return;
        if (video.paused || video.ended) return;
        try {
            if (supportsWebkitPiP(video) && typeof video.webkitSetPresentationMode === 'function') {
                // Track only PiP entered by Tube Cleaner. PiP entered manually
                // from Safari's controls must remain under the user's control.
                pipActive = true;
                video.webkitSetPresentationMode('picture-in-picture');
                log('PiP entered');
            } else if (typeof video.requestPictureInPicture === 'function') {
                pipActive = true;
                var request = video.requestPictureInPicture();
                if (request && request.catch) {
                    request.catch(function (e) {
                        pipActive = false;
                        log('PiP request rejected', e);
                    });
                }
                log('PiP entered via API');
            }
        } catch (e) {
            pipActive = false;
            warn('enterPiP failed', e);
        }
    }

    function exitPiP(video) {
        if (!video || !pipActive) return;
        if (!isPiPActive(video)) {
            pipActive = false;
            return;
        }
        try {
            if (supportsWebkitPiP(video) && typeof video.webkitSetPresentationMode === 'function') {
                video.webkitSetPresentationMode('inline');
                pipActive = false;
                log('PiP exited');
            } else if (document.pictureInPictureElement && typeof document.exitPictureInPicture === 'function') {
                var request = document.exitPictureInPicture();
                if (request && request.catch) {
                    request.catch(function (e) { log('PiP exit rejected', e); });
                }
                pipActive = false;
            }
        } catch (e) { warn('exitPiP failed', e); }
    }

    function setupAutoPiP(video) {
        if (!video || video._wblockAutoPiPHooked) return;
        video._wblockAutoPiPHooked = true;

        // Tab switch: enter PiP when tab hides, exit when visible.
        // Note: enableBackgroundPlayback() overrides document.hidden to always
        // return false, so we use _realHidden which tracks the true state.
        function onVisibilityChange() {
            if (!autoPiPEnabled) return;
            if (_realHidden) {
                if (!video.paused && !video.ended) {
                    enterPiP(video);
                }
            } else if (document.hasFocus() && isPiPActive(video)) {
                exitPiP(video);
            }
        }

        // Losing keyboard focus does not mean the video is obscured on macOS:
        // another visible window may simply be active beside Safari. Enter PiP
        // only for actual page hiding or when the video scrolls out of view.
        function onFocus() {
            if (!autoPiPEnabled) return;
            if (_realHidden) return;
            if (document.hasFocus() && isPiPActive(video)) {
                exitPiP(video);
            }
        }

        function onPageHide(e) {
            if (e && e.persisted) return;
            try { video.pause(); } catch (err) { /* ignore */ }
            exitPiP(video);
        }

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onFocus);
        window.addEventListener('pagehide', onPageHide);

        // Scroll out of view: use IntersectionObserver.
        // On mobile YouTube the watch player is normally position:fixed (sticky).
        // Tube Cleaner overrides it to position:absolute so it scrolls with the
        // page. Without this guard the observer would enter PiP every time the
        // user scrolls past the video to read comments.
        var stickyContainer = document.getElementById('player-container-id');
        var skipScrollPiP = !!(stickyContainer && stickyContainer.classList.contains('sticky-player'));
        var scrollObserver = null;
        if (!skipScrollPiP) {
            scrollObserver = new IntersectionObserver(function (entries) {
                if (!autoPiPEnabled) return;
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting && !video.paused && !video.ended) {
                        enterPiP(video);
                    } else if (entry.isIntersecting && isPiPActive(video)) {
                        exitPiP(video);
                    }
                });
            }, { threshold: 0.1 });
            scrollObserver.observe(video);
        }

        // Listen for presentation mode changes
        function onPresentationModeChange() {
            if (video.webkitPresentationMode !== 'picture-in-picture') {
                pipActive = false;
            }
            log('presentation mode changed:', video.webkitPresentationMode);
        }
        function onLeavePictureInPicture() { pipActive = false; }
        video.addEventListener('webkitpresentationmodechanged', onPresentationModeChange);
        video.addEventListener('leavepictureinpicture', onLeavePictureInPicture);

        // Release all of the above when this video is superseded, so listeners
        // and observers do not accumulate across SPA navigations.
        registerCleanup(function () {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('pagehide', onPageHide);
            try { if (scrollObserver) scrollObserver.disconnect(); } catch (e) { /* ignore */ }
            video.removeEventListener('webkitpresentationmodechanged', onPresentationModeChange);
            video.removeEventListener('leavepictureinpicture', onLeavePictureInPicture);
        });
    }

    // ------------------------------------------------------------------
    // Preferences
    // ------------------------------------------------------------------

    function isAudioOnly() {
        try { return localStorage.getItem(STORAGE_AUDIO) === '1'; } catch (e) { return false; }
    }

    function setAudioOnly(v) {
        try { localStorage.setItem(STORAGE_AUDIO, v ? '1' : '0'); } catch (e) { /* ignore */ }
    }

    function getPreferredQuality() {
        try { return localStorage.getItem(STORAGE_QUALITY) || 'auto'; } catch (e) { return 'auto'; }
    }

    function setPreferredQuality(q) {
        try { localStorage.setItem(STORAGE_QUALITY, q); } catch (e) { /* ignore */ }
    }

    // ------------------------------------------------------------------
    // CSS injected into the page
    // ------------------------------------------------------------------

    var STYLE_ID = 'wblock-tc-style';

    var CSS = [
        // Hide YouTube's player chrome entirely. The native <video>
        // element gets its own controls from Safari.
        '#movie_player .ytp-chrome-top,',
        '#movie_player .ytp-chrome-bottom,',
        '#movie_player .ytp-gradient-top,',
        '#movie_player .ytp-gradient-bottom,',
        '#movie_player .ytp-title,',
        '#movie_player .ytp-pip-button,',
        '#movie_player .ytp-chrome-controls,',
        '#movie_player .ytp-right-controls,',
        '#movie_player .ytp-left-controls,',
        '#movie_player .ytp-play-button,',
        '#movie_player .ytp-volume-area,',
        '#movie_player .ytp-time-display,',
        '#movie_player .ytp-progress-bar,',
        '#movie_player .ytp-progress-bar-container,',
        '#movie_player .ytp-settings-button,',
        '#movie_player .ytp-settings-menu,',
        '#movie_player .ytp-panel,',
        '#movie_player .ytp-panel-menu,',
        '#movie_player .ytp-quality-menu,',
        '#movie_player .ytp-fullscreen-button,',
        '#movie_player .ytp-remote-button,',
        '#movie_player .ytp-size-button,',
        '#movie_player .ytp-subtitles-button,',
        '#movie_player .ytp-autonav-endscreen-button,',
        '#movie_player .ytp-share-button,',
        '#movie_player .ytp-watch-later-button,',
        '#movie_player .ytp-menuitem,',
        // Storyboard scrubbing preview
        '.ytp-storyboard-framepreview,',
        '.ytp-tooltip,',
        // Ad overlays
        '.ytp-ad-module,',
        '.video-ads,',
        '#player-ads,',
        '.ytp-ad-overlay-container,',
        '.ytp-ad-overlay-slot,',
        '.ytp-ad-image-overlay,',
        '.ytp-ad-overlay-image,',
        '.ytp-ad-badge,',
        // Annotations, cards, end screen
        '.ytp-ce-element,',
        '.ytp-cards-teaser,',
        '.iv-branding,',
        '.ytp-ce-covering-overlay,',
        '.ytp-ce-cover,',
        // Pause overlay
        '.ytp-pause-overlay,',
        // Autoplay countdown
        '.ytp-autonav-endscreen-countdown-overlay,',
        '.ytp-autonav-toggle-button-container,',
        // Info panel
        '.ytp-video-info-panel,',
        // Channel watermark
        '.ytp-watermark,',
        // Related videos overlay
        '.ytp-related-overlay,',
        // Large play button in center
        '.ytp-large-play-button,',
        // Unplayable text
        '.ytp-error,',
        // Spoiler overlay
        '.ytp-spoiler-overlay',
        '{ display: none !important; }',

        // Make the video container fully transparent so only the
        // native <video> element shows through.
        '#movie_player .html5-video-player,',
        '#movie_player',
        '{ background: transparent !important; }',

        // Remove padding/margins that YouTube adds for its controls.
        '#movie_player .html5-video-container',
        '{ position: static !important; }',

        // YouTube sizes and offsets the media element itself when the source is
        // narrower than 16:9. Once width/height are overridden below, retaining
        // that old left/top offset pushes square and vertical videos to one side.
        // Give Safari the whole player box and let object-fit center the picture.
        '#movie_player video',
        '{ position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; object-fit: contain !important; object-position: center center !important; }',

        // Hide the YouTube player container's custom cursor.
        '#movie_player',
        '{ cursor: default !important; }',

        // Hide the "Youtube" link in the player.
        '.ytp-youtube-button,',
        '.ytp-title-link',
        '{ display: none !important; }',

        // Ensure the player container doesn't clip our toolbar.
        '#movie_player',
        '{ overflow: visible !important; }',

        // Toolbar is hidden by default, appears on hover near bottom.
        // '.wblock-tc-toolbar',
        // '{ opacity: 1 !important; display: flex !important; }',

        // Ensure the native controls bar is visible on the video.
        // YouTube's player often sets the video to be a child of
        // elements with overflow:hidden or pointer-events:none.
        '.wblock-tc-native video',
        '{ display: block !important; pointer-events: auto !important; }',

        // YouTube leaves several transparent gesture/feedback layers above the
        // media element. They must not steal taps from Safari's native controls.
        '.wblock-tc-native .ytp-cued-thumbnail-overlay,',
        '.wblock-tc-native .ytp-paid-content-overlay,',
        '.wblock-tc-native .ytp-bezel,',
        '.wblock-tc-native .ytp-spinner,',
        '.wblock-tc-native .ytp-doubletap-ui-legacy,',
        '.wblock-tc-native .ytp-touch-response,',
        '.wblock-tc-native .ytp-player-content,',
        '.wblock-tc-native .html5-video-container',
        '{ pointer-events: none !important; }',

        // YouTube adds new transparent layers without keeping the class names
        // above stable. Keep every unknown descendant behind Safari's controls,
        // then restore the Tube Cleaner surfaces that must remain interactive.
        '.wblock-tc-native *',
        '{ pointer-events: none !important; }',
        '.wblock-tc-native video,',
        '.wblock-tc-native .ytp-unmute,',
        '.wblock-tc-native .wblock-tc-toolbar,',
        '.wblock-tc-native .wblock-tc-toolbar *,',
        '.wblock-tc-native .wblock-tc-sponsor-notice,',
        '.wblock-tc-native .wblock-tc-sponsor-notice *',
        '{ pointer-events: auto !important; }',

        // Mobile YouTube renders its new controls outside #movie_player in a
        // sibling custom-element tree. It appears after "Tap to unmute" and
        // otherwise sits above Safari's native media controls.
        '#player-control-container,',
        'ytm-custom-control,',
        'ytm-watch-player-controls',
        '{ display: none !important; pointer-events: none !important; }',

        // Mobile YouTube pins the watch player below its fixed header by adding
        // sticky-player and position:fixed to this body-level container. Keep it
        // at the same document position, but let it leave the viewport normally
        // when the user scrolls down the watch page.
        '#player-container-id.player-container',
        '{ position: absolute !important; }',

        // The related-videos filter chip bar ("All / Related / For you ...") is
        // sticky with top: calc(96px + 56.25vw), calibrated for the stock layout
        // where the player is position:fixed at the top of the viewport. Once the
        // player scrolls away (position:absolute above), that offset leaves the
        // bar floating mid-screen over the related content. Pin it to the header
        // so it sticks at the top of the viewport when scrolling past the player.
        'ytm-related-chip-cloud-renderer',
        '{ top: 48px !important; }',

        // Do not style Safari's private ::-webkit-media-controls tree. iOS and
        // macOS use different internal layouts, and forcing display/flex on the
        // iOS shadow controls breaks both video painting and touch hit-testing.

        // Make sure the video container allows native controls to
        // render by removing overflow hidden.
        '#movie_player .html5-video-container',
        '{ overflow: visible !important; }',

        // Let the native controls bar extend below the video.
        '.wblock-tc-native',
        '{ overflow: visible !important; }',

        // The active desktop-Shorts player is not guaranteed to use the
        // movie_player id. Repeat the critical cleanup rules against the class
        // applied by Tube Cleaner so alternate YouTube player instances receive
        // the same native layout.
        '.wblock-tc-native .ytp-chrome-top,',
        '.wblock-tc-native .ytp-chrome-bottom,',
        '.wblock-tc-native .ytp-gradient-top,',
        '.wblock-tc-native .ytp-gradient-bottom,',
        '.wblock-tc-native .ytp-title,',
        '.wblock-tc-native .ytp-large-play-button,',
        '.wblock-tc-native .ytp-ad-module,',
        '.wblock-tc-native .video-ads,',
        '.wblock-tc-native .ytp-ad-overlay-container,',
        '.wblock-tc-native .ytp-ce-element,',
        '.wblock-tc-native .ytp-cards-teaser,',
        '.wblock-tc-native .ytp-pause-overlay,',
        '.wblock-tc-native .ytp-autonav-endscreen-countdown-overlay,',
        '.wblock-tc-native .ytp-watermark,',
        '.wblock-tc-native .ytp-related-overlay,',
        '.wblock-tc-native .ytp-inline-preview-ui,',
        '.wblock-tc-native .ytp-inline-preview-scrim,',
        // setQuality() drives YouTube's hidden menu for SABR reliability. Hide
        // its entire shell—not just menu items—so the panel cannot flash while
        // our quality picker changes the setting programmatically.
        '.wblock-tc-native .ytp-settings-menu,',
        '.wblock-tc-native .ytp-panel,',
        '.wblock-tc-native .ytp-panel-menu,',
        '.wblock-tc-native .ytp-quality-menu,',
        '.wblock-tc-native .ytp-error',
        '{ display: none !important; }',

        '.wblock-tc-native .html5-video-container',
        '{ position: static !important; overflow: visible !important; }',

        '.wblock-tc-native video',
        '{ position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; object-fit: contain !important; object-position: center center !important; }',

        // On a regular watch page, square and portrait videos can use more of a
        // narrow viewport by growing the reserved player frame toward their
        // natural ratio. The height is calculated in JavaScript and capped to
        // keep very tall videos from taking over a desktop page.
        '.wblock-tc-aspect-host',
        '{ box-sizing: border-box !important; height: var(--wblock-tc-player-height) !important; min-height: var(--wblock-tc-player-height) !important; max-height: none !important; aspect-ratio: auto !important; padding-top: 0 !important; padding-bottom: 0 !important; }',

        // Some YouTube layouts keep the player in an absolutely positioned,
        // fixed-ratio wrapper. In those layouts, growing #movie_player does not
        // move the watch content below it, so add the unreserved height there.
        '.wblock-tc-content-offset',
        '{ margin-top: var(--wblock-tc-content-margin) !important; }',

        // Prevent iOS double-tap zoom on toolbar buttons.
        '.wblock-tc-toolbar button, .wblock-tc-toolbar div',
        '{ touch-action: manipulation !important; }',

        // Safari paints native <button> chrome light gray on hover. Keep the
        // quality ladder on the dark menu instead of the system control look.
        '.wblock-tc-quality-menu,',
        '.wblock-tc-quality-menu button',
        '{ color-scheme: dark; -webkit-appearance: none; appearance: none; }',
        '.wblock-tc-quality-menu button',
        '{ background: transparent !important; }',
        '.wblock-tc-quality-menu button:hover',
        '{ background: rgba(255,255,255,0.15) !important; }',
        '.wblock-tc-quality-menu button:focus',
        '{ outline: none; }',
    ].join(' ');

    // On mobile YouTube, html5-video-container is the positioned box that
    // anchors the media within the reserved player frame. Making it static
    // lets the native video escape into the watch-page flow, leaving an empty
    // player-sized gap above it. Keep the container's geometry on iOS while
    // still allowing the native controls to receive taps.
    if (IS_IOS) {
        CSS += ' #movie_player.wblock-tc-native .html5-video-container,' +
            ' .wblock-tc-native .html5-video-container' +
            ' { position:absolute !important;inset:0 !important;width:100% !important;height:100% !important; }';
    }

    var AUDIO_ONLY_CSS = [
        '.wblock-tc-native video,',
        '.wblock-tc-native .html5-video-container',
        '{ visibility: hidden !important; }'
    ].join(' ');

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) { return true; }
        var root = document.head || document.documentElement;
        if (!root) { return false; }
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        root.appendChild(style);
        // Shorts pages keep YouTube's stock UI; transformPlayer() re-enables
        // the sheet when the SPA returns to a regular page.
        if (isShortsPath()) { style.disabled = true; }
        return true;
    }

    function setAudioOnlyStyles(enabled) {
        var id = STYLE_ID + '-audio';
        var existing = document.getElementById(id);
        if (enabled && !existing) {
            var style = document.createElement('style');
            style.id = id;
            style.textContent = AUDIO_ONLY_CSS;
            (document.head || document.documentElement).appendChild(style);
        } else if (!enabled && existing) {
            existing.remove();
        }
    }

    // ------------------------------------------------------------------
    // Background playback
    // ------------------------------------------------------------------

    // Track real visibility state separately since we override document.hidden.
    var _realHidden = false;

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

    // Capture initially and keep using the native prototype getters after the
    // document instance properties are shadowed for background playback.
    updateRealVisibility();
    document.addEventListener('visibilitychange', updateRealVisibility);

    function enableBackgroundPlayback() {
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
    }

    // ------------------------------------------------------------------
    // Core: extract the <video> from YouTube's player and make it native
    // ------------------------------------------------------------------

    var currentState = null;

    // ------------------------------------------------------------------
    // Per-video resource tracking
    //
    // YouTube is a single-page app. Navigating between videos (or the player
    // recreating its <video> element) used to leak resources: each new video
    // added more document/window listeners, MutationObservers, and setInterval
    // timers without removing the previous video's. We track the active video's
    // teardown callbacks and run them before activating a new video, so resource
    // counts stay flat no matter how many videos play in a session.
    // ------------------------------------------------------------------

    var activeVideo = null;
    var playerObserver = null;
    var activeCleanups = [];
    var playbackCarry = null;

    function youtubePlayerVideoId(player) {
        try {
            var data = player && typeof player.getVideoData === 'function' ? player.getVideoData() : null;
            var id = data && (data.video_id || data.videoId);
            return id && /^[A-Za-z0-9_-]{11}$/.test(String(id)) ? String(id) : null;
        } catch (e) { return null; }
    }

    function youtubeUrlVideoId() {
        try {
            var pathMatch = location.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
            var queryId = new URLSearchParams(location.search).get('v');
            if (pathMatch) return pathMatch[1];
            if (queryId && /^[A-Za-z0-9_-]{11}$/.test(queryId)) return queryId;
        } catch (e) { /* ignore malformed URLs */ }
        return null;
    }

    function youtubeVideoIdentity(player) {
        // The URL leads the persistent player during SPA navigation. YouTube's
        // player data is the confirmation that the media element changed.
        return youtubePlayerVideoId(player) || youtubeUrlVideoId();
    }

    function readPlaybackPosition(videoId) {
        try {
            var value = JSON.parse(localStorage.getItem(STORAGE_POSITION + videoId) || 'null');
            return value && isFinite(value.time) && value.time > 0 ? Number(value.time) : null;
        } catch (e) { return null; }
    }

    function writePlaybackPosition(videoId, time, duration, ended) {
        try {
            if (ended || (duration > 0 && time >= duration - 0.5)) {
                localStorage.removeItem(STORAGE_POSITION + videoId);
            } else if (isFinite(time)) {
                if (time > 0.25) {
                    localStorage.setItem(STORAGE_POSITION + videoId, JSON.stringify({ time: time, updatedAt: Date.now() }));
                } else {
                    localStorage.removeItem(STORAGE_POSITION + videoId);
                }
            }
        } catch (e) { /* ignore */ }
    }

    function setupPlaybackPosition(player, video) {
        var videoId = youtubeVideoIdentity(player);
        if (!videoId) { playbackCarry = null; return; }
        var previousIdentity = playbackCarry && playbackCarry.identity;
        var carried = playbackCarry && playbackCarry.identity === videoId ? playbackCarry : null;
        playbackCarry = null;
        var cancelled = false;
        var restored = false;
        var stateApplied = !carried;
        var waitingForMediaTransition = !!(previousIdentity && previousIdentity !== videoId);
        var writeTimer = null;
        var saved = readPlaybackPosition(videoId);

        function restore() {
            if (cancelled || restored || waitingForMediaTransition || activeVideo !== video ||
                youtubeVideoIdentity(player) !== videoId) return;
            if (video.readyState < 1 || !isFinite(video.duration) || video.duration <= 0) return;
            restored = true;
            var positionApplied = true;
            if (saved !== null) {
                if (saved >= video.duration - 0.5) {
                    writePlaybackPosition(videoId, 0, video.duration, true);
                } else if (Math.abs(video.currentTime - saved) > 0.75 &&
                    !(carried && previousIdentity === videoId && video.currentTime > 0.25)) {
                    try { video.currentTime = Math.min(saved, Math.max(0, video.duration - 0.1)); }
                    catch (e) { positionApplied = false; }
                }
            }
            if (!positionApplied) { restored = false; return; }
            applyState();
        }

        function applyState() {
            if (cancelled || stateApplied || !carried || activeVideo !== video) return;
            stateApplied = true;
            try {
                if (carried.paused) video.pause();
                else if (video.paused) {
                    var request = video.play();
                    if (request && request.catch) request.catch(function () { /* autoplay policy */ });
                }
            } catch (e) { /* preserve state when the browser permits it */ }
        }

        function persist(force) {
            if (writeTimer !== null) { clearTimeout(writeTimer); writeTimer = null; }
            if (cancelled && !force) return;
            writePlaybackPosition(videoId, Number(video.currentTime), Number(video.duration), video.ended);
        }

        function schedulePersist() {
            if (cancelled || writeTimer !== null) return;
            writeTimer = setTimeout(function () { writeTimer = null; persist(false); }, 1000);
        }

        function onEnded() { persist(true); }
        function onTimeUpdate() { schedulePersist(); }
        function onPause() { schedulePersist(); }
        function onMetadata() {
            if (waitingForMediaTransition) {
                waitingForMediaTransition = false;
                video._wblockConfirmedVideoId = videoId;
            }
            restore();
        }
        function onPageHide() { persist(true); }

        video._wblockPlaybackState = { identity: videoId, paused: video.paused };
        video._wblockConfirmedVideoId = videoId;
        video.addEventListener('loadedmetadata', onMetadata);
        video.addEventListener('durationchange', onMetadata);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        window.addEventListener('pagehide', onPageHide);
        restore();

        registerCleanup(function () {
            if (writeTimer !== null) clearTimeout(writeTimer);
            cancelled = true;
            persist(true);
            video.removeEventListener('loadedmetadata', onMetadata);
            video.removeEventListener('durationchange', onMetadata);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onEnded);
            window.removeEventListener('pagehide', onPageHide);
            delete video._wblockPlaybackState;
        });
    }

    function registerCleanup(fn) {
        activeCleanups.push(fn);
    }

    function releaseActiveVideo() {
        var previousVideo = activeVideo;
        if (previousVideo && previousVideo._wblockPlaybackState) {
            previousVideo._wblockPlaybackState.paused = previousVideo.paused;
            playbackCarry = previousVideo._wblockPlaybackState;
        }
        if (qualityRequest) cancelQualityRequest();
        var cleanups = activeCleanups;
        activeCleanups = [];
        for (var i = 0; i < cleanups.length; i++) {
            try { cleanups[i](); } catch (e) { /* ignore */ }
        }
        // The same media element can survive a YouTube SPA navigation. Reset
        // hook flags after teardown so activateVideo() reattaches resources when
        // that element is immediately activated again.
        if (previousVideo) {
            previousVideo._wblockAutoPiPHooked = false;
            previousVideo._wblockControlsGuarded = false;
            previousVideo._wblockControlsPatched = false;
            previousVideo._wblockMediaSessionHooked = false;
        }
        activeVideo = null;
        pipActive = false;
    }

    // Grow a regular watch-page player toward a narrow video's natural aspect
    // ratio. YouTube reserves a 16:9 frame even for square and portrait uploads;
    // in narrow layouts that wastes most of the available width. Expand only
    // when doing so makes the player taller, and cap the result at 85% of the
    // viewport so a portrait upload cannot dominate a large desktop page.
    function setupVideoAspectLayout(player, video) {
        if (!player || !video) return;
        var isHarness = location.protocol === 'file:';
        var isWatchPage = /^\/watch(?:\/|$)/.test(location.pathname);
        if (!isHarness && (!isWatchPage || location.hostname === 'music.youtube.com')) return;
        if (/^\/shorts(?:\/|$)/.test(location.pathname)) return;

        var hosts = [];
        var updateFrame = null;
        var resizeObserver = null;
        var contentAnchor = null;

        function clearLayout() {
            if (contentAnchor) {
                contentAnchor.classList.remove('wblock-tc-content-offset');
                contentAnchor.style.removeProperty('--wblock-tc-content-margin');
                contentAnchor = null;
            }
            for (var i = 0; i < hosts.length; i++) {
                hosts[i].classList.remove('wblock-tc-aspect-host');
                hosts[i].style.removeProperty('--wblock-tc-player-height');
            }
            hosts = [];
        }

        // Find the first watch-page block after the player. Known desktop and
        // mobile containers are preferred; walking outward to the first visible
        // next sibling covers YouTube experiments with different tag names.
        function findContentAnchor(rect) {
            var selectors = [
                '#below',
                'ytm-single-column-watch-next-results-renderer',
                'ytm-watch-next-secondary-results-renderer',
                'ytm-slim-video-metadata-section-renderer',
                'ytd-watch-metadata',
                '#watch-metadata'
            ];
            for (var i = 0; i < selectors.length; i++) {
                var candidate = document.querySelector(selectors[i]);
                if (!candidate || candidate.contains(player) || player.contains(candidate)) continue;
                var candidateRect = candidate.getBoundingClientRect();
                if (candidateRect.width && candidateRect.top >= rect.bottom - 16) return candidate;
            }

            var node = player;
            for (var depth = 0; node && node.parentElement && depth < 12; depth++) {
                var sibling = node.nextElementSibling;
                while (sibling) {
                    var siblingRect = sibling.getBoundingClientRect();
                    if (siblingRect.width && siblingRect.height && siblingRect.top >= rect.bottom - 16) {
                        return sibling;
                    }
                    sibling = sibling.nextElementSibling;
                }
                node = node.parentElement;
                if (node === document.body || node === document.documentElement) break;
            }
            return null;
        }

        // Resize every consecutive wrapper that currently reserves exactly the
        // same box as #movie_player. This moves watch metadata down with the
        // taller player without touching unrelated page columns or the body.
        function findHosts(rect) {
            if (!rect.width || !rect.height) return;
            var node = player;
            for (var depth = 0; node && depth < 8; depth++) {
                if (node === document.body || node === document.documentElement) break;
                var nodeRect = node.getBoundingClientRect();
                if (Math.abs(nodeRect.width - rect.width) > 4 ||
                    Math.abs(nodeRect.height - rect.height) > 4) break;
                hosts.push(node);
                node = node.parentElement;
            }
        }

        // Mobile YouTube keeps the player in a body-level fixed container and
        // reserves flow space with a separate .player-placeholder div inside
        // ytm-watch. Rebuild this list after each geometry change so recycled
        // containers do not retain the old video's sizing.
        function ensurePlaceholderHost() {
            var placeholder = document.querySelector('.player-placeholder');
            if (placeholder && !player.contains(placeholder) && !placeholder.contains(player)) {
                var found = false;
                for (var i = 0; i < hosts.length; i++) {
                    if (hosts[i] === placeholder) { found = true; break; }
                }
                if (!found) hosts.push(placeholder);
            }
        }

        function observeGeometryHosts() {
            if (!resizeObserver) return;
            for (var i = 0; i < hosts.length; i++) {
                try { resizeObserver.observe(hosts[i]); } catch (e) { /* ignore recycled nodes */ }
            }
        }

        function updateLayout() {
            updateFrame = null;
            clearLayout();
            var rect = player.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            var baseAspect = rect.width / rect.height;
            findHosts(rect);
            ensurePlaceholderHost();
            observeGeometryHosts();

            var fullscreen = document.fullscreenElement || document.webkitFullscreenElement ||
                player.classList.contains('ytp-fullscreen') || video.webkitDisplayingFullscreen === true ||
                video.webkitPresentationMode === 'fullscreen';
            var sourceWidth = Number(video.videoWidth) || 0;
            var sourceHeight = Number(video.videoHeight) || 0;
            if (fullscreen || !sourceWidth || !sourceHeight || !hosts.length) {
                clearLayout();
                return;
            }

            var baseHeight = rect.width / baseAspect;
            var naturalHeight = rect.width * sourceHeight / sourceWidth;
            var viewportHeight = document.documentElement.clientHeight || window.innerHeight || baseHeight;
            var targetHeight = Math.min(naturalHeight, Math.max(baseHeight, viewportHeight * 0.85));
            if (targetHeight <= baseHeight + 2) {
                clearLayout();
                return;
            }

            var heightValue = Math.round(targetHeight * 100) / 100 + 'px';
            for (var i = 0; i < hosts.length; i++) {
                hosts[i].style.setProperty('--wblock-tc-player-height', heightValue);
                hosts[i].classList.add('wblock-tc-aspect-host');
            }

            // Content offset: when the outermost host is out of normal flow
            // (position:fixed/absolute), growing it does not push the watch
            // content below it. Add a margin-top to compensate. Compute this
            // synchronously (one forced reflow) instead of a second rAF to
            // avoid a visible one-frame jump.
            var anchor = findContentAnchor(rect);
            if (anchor) {
                // Remove our previous offset so we can read the natural position.
                if (anchor === contentAnchor) {
                    anchor.classList.remove('wblock-tc-content-offset');
                    anchor.style.removeProperty('--wblock-tc-content-margin');
                }
                var naturalTop = anchor.getBoundingClientRect().top;
                var playerBottom = player.getBoundingClientRect().bottom;
                var gap = playerBottom - naturalTop;
                if (gap > 1) {
                    // Add the gap to the element's existing margin so the total
                    // margin pushes it below the expanded player.
                    var existingMargin = parseFloat(getComputedStyle(anchor).marginTop) || 0;
                    var marginValue = Math.round((existingMargin + gap) * 100) / 100 + 'px';
                    anchor.style.setProperty('--wblock-tc-content-margin', marginValue);
                    anchor.classList.add('wblock-tc-content-offset');
                    contentAnchor = anchor;
                } else {
                    contentAnchor = null;
                }
            } else if (contentAnchor) {
                contentAnchor.classList.remove('wblock-tc-content-offset');
                contentAnchor.style.removeProperty('--wblock-tc-content-margin');
                contentAnchor = null;
            }
        }

        function scheduleUpdate() {
            if (updateFrame !== null) return;
            updateFrame = requestAnimationFrame(updateLayout);
        }

        video.addEventListener('loadedmetadata', scheduleUpdate);
        video.addEventListener('resize', scheduleUpdate);
        video.addEventListener('emptied', scheduleUpdate);
        window.addEventListener('resize', scheduleUpdate);
        if (typeof ResizeObserver !== 'undefined') {
            try {
                resizeObserver = new ResizeObserver(scheduleUpdate);
                resizeObserver.observe(player);
                if (player.parentElement) resizeObserver.observe(player.parentElement);
            } catch (e) { resizeObserver = null; }
        }
        document.addEventListener('fullscreenchange', scheduleUpdate);
        document.addEventListener('webkitfullscreenchange', scheduleUpdate);
        video.addEventListener('webkitbeginfullscreen', scheduleUpdate);
        video.addEventListener('webkitendfullscreen', scheduleUpdate);
        video.addEventListener('webkitpresentationmodechanged', scheduleUpdate);
        video.addEventListener('enterpictureinpicture', scheduleUpdate);
        video.addEventListener('leavepictureinpicture', scheduleUpdate);
        scheduleUpdate();

        registerCleanup(function () {
            video.removeEventListener('loadedmetadata', scheduleUpdate);
            video.removeEventListener('resize', scheduleUpdate);
            video.removeEventListener('emptied', scheduleUpdate);
            window.removeEventListener('resize', scheduleUpdate);
            document.removeEventListener('fullscreenchange', scheduleUpdate);
            document.removeEventListener('webkitfullscreenchange', scheduleUpdate);
            video.removeEventListener('webkitbeginfullscreen', scheduleUpdate);
            video.removeEventListener('webkitendfullscreen', scheduleUpdate);
            video.removeEventListener('webkitpresentationmodechanged', scheduleUpdate);
            video.removeEventListener('enterpictureinpicture', scheduleUpdate);
            video.removeEventListener('leavepictureinpicture', scheduleUpdate);
            if (resizeObserver) { try { resizeObserver.disconnect(); } catch (e) { /* ignore */ } }
            resizeObserver = null;
            if (updateFrame !== null) cancelAnimationFrame(updateFrame);
            clearLayout();
        });
    }

    // Activate a video element: tear down the previous video's resources first,
    // then apply every per-video enhancement. Called on first transform and again
    // whenever the player recreates its <video> element.
    function activateVideo(player, video) {
        releaseActiveVideo();
        activeVideo = video;
        setupPlaybackPosition(player, video);
        registerCleanup(cancelQualityRequest);
        forceNativeControls(video);
        guardNativeControls(video);
        pinNativeControls(video);

        // Safari's controls live in WebKit's shadow tree, so let events reach
        // the video in the bubble phase but stop YouTube's outer player shell
        // from treating native scrubber and long-press gestures as player taps.
        // Blocking the move and mouse-compat events keeps YouTube's bubble-phase
        // handlers quiet, but its capture-phase document handlers run first and
        // still see the stream; pinNativeControls() is what actually keeps a
        // native scrubber drag alive.
        var competingEvents = [
            'click', 'pointerdown', 'pointermove', 'pointerup',
            'mousedown', 'mousemove', 'mouseup',
            'touchstart', 'touchmove', 'touchend'
        ];
        function blockCompetingClicks(event) { event.stopPropagation(); }
        for (var i = 0; i < competingEvents.length; i++) {
            video.addEventListener(competingEvents[i], blockCompetingClicks);
        }
        registerCleanup(function () {
            for (var i = 0; i < competingEvents.length; i++) {
                video.removeEventListener(competingEvents[i], blockCompetingClicks);
            }
        });

        setupVideoAspectLayout(player, video);
        // Keep YouTube's media listeners intact. SABR/MSE uses waiting,
        // stalled, progress, and related events to maintain the stream. The
        // iOS toolbar contains only a compact quality selector positioned above
        // Safari's native controls; playback remains owned by the video element.
        buildToolbar(player, video);
        setupAutoPiP(video);
        setupMediaSession(player, video);
        setupChapters(player, video);
        setupNativeSubtitles(player, video);
        // setupSponsorBlock(player, video);
    }

    var mediaSessionOwner = null;

    function setupMediaSession(container, video) {
        if (!video || video._wblockMediaSessionHooked || !navigator.mediaSession ||
            typeof MediaMetadata === 'undefined') return;
        video._wblockMediaSessionHooked = true;
        var session = navigator.mediaSession;
        var positionTimer = null;
        var metadataTimer = null;

        function meta(name) {
            var element = document.querySelector('meta[property="' + name + '"],meta[name="' + name + '"]');
            return element && element.content || '';
        }

        function playerData() {
            var player = findPlayer();
            try { return player && typeof player.getVideoData === 'function' ? player.getVideoData() || {} : {}; }
            catch (e) { return {}; }
        }

        function metadataData() {
            var data = playerData();
            var details = window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.videoDetails || {};
            var title = data.title || details.title || meta('og:title') || document.title || location.hostname;
            var artist = data.author || data.ownerChannelName || details.author || details.channelTitle ||
                meta('og:site_name') || location.hostname;
            var thumbnails = (data.thumbnail && data.thumbnail.thumbnails) || (details.thumbnail && details.thumbnail.thumbnails);
            var artwork = video.poster || (thumbnails && thumbnails.length && thumbnails[thumbnails.length - 1].url) || meta('og:image');
            var result = { title: String(title), artist: String(artist) };
            if (artwork) result.artwork = [{ src: String(artwork) }];
            var chapters = video._wblockChapterData;
            if (chapters && chapters.length) {
                result.chapterInfo = chapters.map(function (chapter) {
                    return { startTime: chapter.start, title: chapter.title };
                });
            }
            return result;
        }

        function clearOwner(previous) {
            if (!previous || mediaSessionOwner !== previous) return;
            (previous._wblockMediaActions || []).forEach(function (action) {
                try { if (typeof session.setActionHandler === 'function') session.setActionHandler(action, null); } catch (e) { /* ignore */ }
            });
            if (session.metadata === previous._wblockMediaMetadata) {
                try { session.metadata = null; } catch (e) { /* ignore */ }
            }
            previous._wblockMediaActions = null;
            previous._wblockMediaMetadata = null;
        }

        function refreshMetadata() {
            if (mediaSessionOwner !== video) return;
            var data = metadataData();
            var metadata;
            try { metadata = new MediaMetadata(data); }
            catch (e) {
                delete data.chapterInfo;
                try { metadata = new MediaMetadata(data); }
                catch (ignored) {
                    delete data.artwork;
                    try { metadata = new MediaMetadata(data); } catch (ignoredAgain) { return; }
                }
            }
            if (mediaSessionOwner !== video) return;
            video._wblockMediaMetadata = metadata;
            try { session.metadata = metadata; } catch (e) { /* ignore */ }
        }

        function scheduleMetadata() {
            if (metadataTimer !== null) return;
            metadataTimer = setTimeout(function () {
                metadataTimer = null;
                refreshMetadata();
            }, 50);
        }

        function updateState() {
            if (mediaSessionOwner !== video) return;
            try { session.playbackState = video.ended ? 'none' : (video.paused ? 'paused' : 'playing'); }
            catch (e) { /* ignore */ }
        }

        function updatePosition() {
            if (mediaSessionOwner !== video || typeof session.setPositionState !== 'function' || positionTimer !== null) return;
            positionTimer = setTimeout(function () {
                positionTimer = null;
                if (mediaSessionOwner !== video) return;
                var duration = Number(video.duration), position = Number(video.currentTime), rate = Number(video.playbackRate) || 1;
                if (!isFinite(duration) || duration <= 0 || !isFinite(position) || position < 0 || !isFinite(rate) || rate <= 0) return;
                try { session.setPositionState({ duration: duration, playbackRate: rate, position: Math.min(position, duration) }); }
                catch (e) { /* ignore transient media state */ }
            }, 200);
        }

        function seekBy(offset) {
            var amount = Number(offset);
            if (!isFinite(amount) || amount === 0) amount = 10;
            try { video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + amount)); }
            catch (e) { /* ignore */ }
        }

        function claim() {
            if (mediaSessionOwner !== video) {
                clearOwner(mediaSessionOwner);
                mediaSessionOwner = video;
            }
            refreshMetadata();
            updateState();
            updatePosition();
            if (typeof session.setActionHandler !== 'function') return;
            var actions = {
                play: function () { var request = video.play(); if (request && request.catch) request.catch(function () {}); },
                pause: function () { try { video.pause(); } catch (e) {} },
                seekbackward: function (details) { seekBy(-(details && details.seekOffset || 10)); },
                seekforward: function (details) { seekBy(details && details.seekOffset || 10); },
                seekto: function (details) {
                    if (!details || !isFinite(details.seekTime)) return;
                    try {
                        if (details.fastSeek && typeof video.fastSeek === 'function') video.fastSeek(details.seekTime);
                        else video.currentTime = details.seekTime;
                    } catch (e) { /* ignore */ }
                },
                stop: function () { try { video.pause(); video.currentTime = 0; } catch (e) {} }
            };
            video._wblockMediaActions = Object.keys(actions);
            for (var action in actions) {
                try { session.setActionHandler(action, actions[action]); } catch (e) { /* unsupported action */ }
            }
        }

        function onPlay() { claim(); }
        function onPause() { updateState(); updatePosition(); }
        function onEnded() { updateState(); updatePosition(); }
        function onMetadataChange() { scheduleMetadata(); updatePosition(); }
        function onRateChange() { scheduleMetadata(); updatePosition(); }
        function onTimeUpdate() { updatePosition(); }
        function onNavigate() { scheduleMetadata(); }

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        video.addEventListener('loadedmetadata', onMetadataChange);
        video.addEventListener('durationchange', onMetadataChange);
        video.addEventListener('loadeddata', onMetadataChange);
        video.addEventListener('ratechange', onRateChange);
        video.addEventListener('timeupdate', onTimeUpdate);
        document.addEventListener('yt-navigate-finish', onNavigate, true);
        document.addEventListener('yt-page-data-updated', onNavigate, true);
        if (!video.paused) claim();

        registerCleanup(function () {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onEnded);
            video.removeEventListener('loadedmetadata', onMetadataChange);
            video.removeEventListener('durationchange', onMetadataChange);
            video.removeEventListener('loadeddata', onMetadataChange);
            video.removeEventListener('ratechange', onRateChange);
            video.removeEventListener('timeupdate', onTimeUpdate);
            document.removeEventListener('yt-navigate-finish', onNavigate, true);
            document.removeEventListener('yt-page-data-updated', onNavigate, true);
            if (positionTimer !== null) clearTimeout(positionTimer);
            if (metadataTimer !== null) clearTimeout(metadataTimer);
            positionTimer = null;
            metadataTimer = null;
            if (mediaSessionOwner !== video) return;
            mediaSessionOwner = null;
            if (session.metadata === video._wblockMediaMetadata) {
                try { session.metadata = null; } catch (e) { /* ignore */ }
            }
            (video._wblockMediaActions || []).forEach(function (action) {
                try { if (typeof session.setActionHandler === 'function') session.setActionHandler(action, null); } catch (e) { /* ignore */ }
            });
            try { session.playbackState = 'none'; } catch (e) { /* ignore */ }
            video._wblockMediaMetadata = null;
            video._wblockMediaActions = null;
        });
    }

    function restoreNativeMediaCapabilities(video) {
        if (!video) return;
        try {
            if (!video.controls) { video.controls = true; }
            if (!video.hasAttribute('controls')) { video.setAttribute('controls', ''); }
            ensurePlaysInline(video);
            // YouTube may suppress native PiP and fullscreen-adjacent controls
            // while its custom chrome is active. Those restrictions no longer
            // apply once Safari's native controls own interaction.
            if (video.hasAttribute('controlslist')) { video.removeAttribute('controlslist'); }
            if (video.hasAttribute('disablepictureinpicture')) { video.removeAttribute('disablepictureinpicture'); }
            if (video.disablePictureInPicture) { video.disablePictureInPicture = false; }

            var opaque = hasOpaqueMediaSource(video);
            if (IS_IOS) {
                // WebKit requires remote playback to stay disabled for ManagedMediaSource/blob playback.
                if (!video.disableRemotePlayback) { video.disableRemotePlayback = true; }
                if (!video.hasAttribute('disableremoteplayback')) {
                    video.setAttribute('disableremoteplayback', '');
                }
                if (video.getAttribute('x-webkit-airplay') === 'allow') video.removeAttribute('x-webkit-airplay');
            } else if (!opaque) {
                if (video.hasAttribute('disableremoteplayback')) { video.removeAttribute('disableremoteplayback'); }
                if (video.disableRemotePlayback) { video.disableRemotePlayback = false; }
                if (video.getAttribute('x-webkit-airplay') !== 'allow') {
                    video.setAttribute('x-webkit-airplay', 'allow');
                }
            } else if (video.getAttribute('x-webkit-airplay') === 'allow') {
                video.removeAttribute('x-webkit-airplay');
            }
        } catch (e) { /* ignore */ }
    }

    function forceNativeControls(video) {
        if (video._wblockControlsPatched) return;
        video._wblockControlsPatched = true;
        restoreNativeMediaCapabilities(video);
    }

    // WebKit renders Safari's native controls from the controls content
    // attribute. Do not replace the native property descriptor: early instance
    // shadowing can break WebKit's own media-controls initialization. Restore the
    // attribute at each mutation microtask instead.
    function guardNativeControls(video) {
        if (!video || video._wblockControlsGuarded) return;
        video._wblockControlsGuarded = true;

        function restore() { restoreNativeMediaCapabilities(video); }

        var observer = null;
        try {
            observer = new MutationObserver(restore);
            observer.observe(video, {
                attributes: true,
                attributeFilter: [
                    'controls', 'controlslist', 'disablepictureinpicture',
                    'disableremoteplayback', 'playsinline',
                    'webkit-playsinline', 'x-webkit-airplay'
                ]
            });
        } catch (e) { /* ignore */ }

        restore();

        registerCleanup(function () {
            if (observer) { try { observer.disconnect(); } catch (e) { /* ignore */ } }
        });
    }

    // The observer restore above is not enough for native scrubber drags.
    // YouTube's activity handlers listen in the capture phase on the document
    // and player ancestors, so they run before the video's bubble-phase
    // blockers no matter what, and they respond to the pointer stream by
    // clearing the controls attribute. The restore re-adds it a microtask
    // later, but WebKit has already torn down and rebuilt the inline shadow
    // controls, cancelling the drag after a few pixels (0.1.13 shipped only
    // bubble-phase blockers, which is why drags still died outside
    // fullscreen). Stop the teardown at the source instead: while Tube
    // Cleaner owns the video, writes that would turn the controls attribute
    // off are ignored. Shadowing is installed only after the attribute is
    // natively set, so WebKit's media-controls initialization is unaffected.
    function pinNativeControls(video) {
        if (!video || video._wblockControlsPinned) return;
        video._wblockControlsPinned = true;

        var nativeRemoveAttribute = video.removeAttribute;
        var nativeSetAttribute = video.setAttribute;
        var nativeToggleAttribute = video.toggleAttribute;

        function isControlsName(name) {
            return String(name).toLowerCase() === 'controls';
        }

        try {
            video.removeAttribute = function (name) {
                if (isControlsName(name)) return;
                return nativeRemoveAttribute.apply(this, arguments);
            };
            video.setAttribute = function (name) {
                // A redundant re-set still runs WebKit's attribute-changed
                // path; skip it so nothing rebuilds the shadow controls.
                if (isControlsName(name) && this.hasAttribute('controls')) return;
                return nativeSetAttribute.apply(this, arguments);
            };
            if (typeof nativeToggleAttribute === 'function') {
                video.toggleAttribute = function (name) {
                    if (isControlsName(name)) {
                        if (!this.hasAttribute('controls')) {
                            nativeSetAttribute.call(this, 'controls', '');
                        }
                        return true;
                    }
                    return nativeToggleAttribute.apply(this, arguments);
                };
            }
            var descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'controls');
            if (descriptor && descriptor.get && descriptor.set) {
                Object.defineProperty(video, 'controls', {
                    configurable: true,
                    get: function () { return descriptor.get.call(this); },
                    set: function (value) { if (value) { descriptor.set.call(this, true); } }
                });
            }
        } catch (e) { /* partial pin; the observer restore still applies */ }

        registerCleanup(function () {
            video._wblockControlsPinned = false;
            try { delete video.removeAttribute; } catch (e) { /* ignore */ }
            try { delete video.setAttribute; } catch (e) { /* ignore */ }
            try { delete video.toggleAttribute; } catch (e) { /* ignore */ }
            try { delete video.controls; } catch (e) { /* ignore */ }
        });
    }

    // Ensure inline playback on iOS/iPadOS. Without `playsinline`, iOS opens the
    // video in the fullscreen system player instead of playing inline. YouTube's
    // desktop player (served to iPadOS by default) may omit this attribute, and
    // since we reuse YouTube's <video> element we must set it ourselves.
    function ensurePlaysInline(video) {
        if (!video) return;
        try {
            if (!video.playsInline) { video.playsInline = true; }
            if (!video.hasAttribute('playsinline')) { video.setAttribute('playsinline', ''); }
            if (!video.hasAttribute('webkit-playsinline')) { video.setAttribute('webkit-playsinline', ''); }
        } catch (e) { /* ignore */ }
    }

    // ------------------------------------------------------------------
    // Chapters
    //
    // Safari's native chapter picker is filled from a <track kind="chapters">
    // element, the same way the CC menu is filled from subtitle tracks.
    // addTextTrack("chapters") creates a JavaScript TextTrack, but WebKit's
    // AVPlayer chapter menu does not enumerate those in-memory tracks. Read
    // YouTube's chapter list from ytInitialData / the player response, build a
    // WebVTT blob, and attach it as a real track element.
    // ------------------------------------------------------------------

    function collectChapterRenderers(node, out) {
        if (!node || typeof node !== 'object') return;
        var seen = typeof WeakSet === 'function' ? new WeakSet() : [];
        var stack = [node];
        while (stack.length) {
            var current = stack.pop();
            if (!current || typeof current !== 'object') continue;
            try {
                if (typeof WeakSet === 'function' && seen.add) {
                    if (seen.has(current)) continue;
                    seen.add(current);
                } else if (seen.indexOf(current) !== -1) {
                    continue;
                } else {
                    seen.push(current);
                }
            } catch (e) { continue; }
            if (Array.isArray(current)) {
                for (var i = 0; i < current.length; i++) stack.push(current[i]);
                continue;
            }
            try {
                if (current.macroMarkersListItemRenderer) out.push(current.macroMarkersListItemRenderer);
            } catch (e) { /* ignore a poisoned getter */ }
            try {
                if (current.chapterRenderer) out.push(current.chapterRenderer);
            } catch (e) { /* ignore a poisoned getter */ }
            try {
                var markersList = current.markersList;
                var markerType = markersList && String(markersList.markerType || '');
                if (markersList && markersList.markers &&
                    /CHAPTER|TIMESTAMP/i.test(markerType) && !/HEATMAP/i.test(markerType)) {
                    var entityId = current.externalVideoId || '';
                    var currentId = currentChapterVideoId();
                    var idMismatch = entityId && currentId &&
                        /^[A-Za-z0-9_-]{11}$/.test(currentId) && entityId !== currentId;
                    if (!idMismatch) {
                        var markers = markersList.markers;
                        for (var m = 0; m < markers.length; m++) {
                            if (markers[m]) { out.push(markers[m]); }
                        }
                    }
                }
            } catch (e) { /* ignore a poisoned getter */ }
            try {
                for (var key in current) {
                    if (Object.prototype.hasOwnProperty.call(current, key)) {
                        try { stack.push(current[key]); } catch (ignored) { /* skip throwing property */ }
                    }
                }
            } catch (e) { /* ignore */ }
        }
    }

    // Parse "0:00", "1:23", or "1:23:45" into seconds.
    function parseTimestamp(text) {
        if (!text) return null;
        var parts = String(text).trim().split(':');
        var seconds = 0;
        for (var i = 0; i < parts.length; i++) {
            var n = parseInt(parts[i], 10);
            if (isNaN(n)) return null;
            seconds = seconds * 60 + n;
        }
        return seconds;
    }

    // Format seconds as m:ss or h:mm:ss for the native chapter menu label.
    function formatTimestamp(sec) {
        sec = Math.max(0, Math.floor(sec));
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        var ss = s < 10 ? '0' + s : '' + s;
        if (h > 0) {
            var mm = m < 10 ? '0' + m : '' + m;
            return h + ':' + mm + ':' + ss;
        }
        return m + ':' + ss;
    }

    function chapterTitle(renderer) {
        try {
            var t = renderer.title;
            if (!t) return '';
            if (typeof t === 'string') return t;
            if (t.simpleText) return t.simpleText;
            if (t.runs && t.runs.length) {
                var s = '';
                for (var i = 0; i < t.runs.length; i++) { s += t.runs[i].text || ''; }
                return s;
            }
        } catch (e) { /* ignore */ }
        return '';
    }

    // Return the object from which chapter renderers are extracted. Keeping its
    // identity lets applyChapters reject an old SPA payload while YouTube is
    // still swapping the persistent player to the next video.
    function chapterDataSource() {
        var sources = [];
        try { if (window.ytInitialData) sources.push(window.ytInitialData); } catch (e) { /* ignore */ }
        try { if (window.ytInitialPlayerResponse) sources.push(window.ytInitialPlayerResponse); } catch (e) { /* ignore */ }
        try {
            var player = findPlayer();
            if (player && typeof player.getPlayerResponse === 'function') {
                var response = player.getPlayerResponse();
                if (response) sources.push(response);
            }
        } catch (e) { /* ignore */ }
        if (!sources.length) return null;
        if (sources.length === 1) return sources[0];
        return sources;
    }

    // Extract YouTube's chapters for the current video as a sorted list of
    // { start, title }. Returns null when the page exposes no chapters.
    function extractChapters(data) {
        data = data || chapterDataSource();
        if (!data) return null;
        var renderers = [];
        try { collectChapterRenderers(data, renderers); } catch (e) { return null; }
        if (!renderers.length) return null;

        var chapters = [];
        var seenKeys = {};
        for (var i = 0; i < renderers.length; i++) {
            var r = renderers[i];
            var title = chapterTitle(r);
            var start = null;
            if (typeof r.timeRangeStartMillis === 'number') {
                start = r.timeRangeStartMillis / 1000;
            } else if (r.startMillis !== undefined && r.startMillis !== null && r.startMillis !== '') {
                var millis = Number(r.startMillis);
                if (isFinite(millis)) { start = millis / 1000; }
            } else {
                try {
                    start = parseTimestamp(r.timeDescription && r.timeDescription.simpleText);
                } catch (e) { start = null; }
            }
            if (title && start !== null && start >= 0) {
                // YouTube mirrors the same chapter list in several places in
                // ytInitialData (the engagement panel, the player overlay, and
                // framework/entity updates). The walk therefore finds each
                // chapter more than once; collapse exact duplicates.
                var key = start + '|' + title;
                if (seenKeys[key]) continue;
                seenKeys[key] = true;
                chapters.push({ start: start, title: title });
            }
        }
        if (!chapters.length) return null;
        chapters.sort(function (a, b) { return a.start - b.start; });
        var normalized = [];
        for (var j = 0; j < chapters.length; j++) {
            if (!normalized.length || chapters[j].start > normalized[normalized.length - 1].start) {
                normalized.push(chapters[j]);
            }
        }
        return normalized;
    }

    function currentChapterVideoId() {
        return youtubeUrlVideoId() || youtubePlayerVideoId(findPlayer()) ||
            location.pathname + location.search;
    }

    function formatVttTimestamp(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        var msTotal = Math.round(sec * 1000);
        var hours = Math.floor(msTotal / 3600000);
        msTotal -= hours * 3600000;
        var minutes = Math.floor(msTotal / 60000);
        msTotal -= minutes * 60000;
        var seconds = Math.floor(msTotal / 1000);
        var millis = msTotal - seconds * 1000;
        function pad(n, width) {
            var s = String(n);
            while (s.length < width) s = '0' + s;
            return s;
        }
        return pad(hours, 2) + ':' + pad(minutes, 2) + ':' + pad(seconds, 2) + '.' + pad(millis, 3);
    }

    function vttCueText(text) {
        return String(text || '').replace(/[\r\n]+/g, ' ').replace(/-->/g, '->');
    }

    function chaptersToWebVtt(chapters, duration) {
        var lines = ['WEBVTT', ''];
        var added = 0;
        for (var i = 0; i < chapters.length; i++) {
            var start = chapters[i].start;
            var end;
            if (i + 1 < chapters.length) {
                end = chapters[i + 1].start;
            } else {
                // Last chapter runs to the end of the media. Before metadata is
                // loaded, use a one-second placeholder so the cue is still valid.
                end = duration !== null ? duration : start + 1;
            }
            if (duration !== null && start >= duration) continue;
            if (duration !== null) end = Math.min(end, duration);
            if (!(end > start)) continue;
            // The native chapter menu renders the cue text verbatim, so
            // prefix the title with its timestamp for an at-a-glance list.
            var label = formatTimestamp(start) + '  ' + vttCueText(chapters[i].title);
            lines.push(formatVttTimestamp(start) + ' --> ' + formatVttTimestamp(end));
            lines.push(label);
            lines.push('');
            added++;
        }
        return { vtt: lines.join('\n'), added: added };
    }

    function hideChapterTrack(element) {
        try {
            if (element && element.track) element.track.mode = 'hidden';
        } catch (e) { /* ignore */ }
    }

    function removeChapterTrack(video) {
        if (!video) return;
        var element = video._wblockChaptersElement;
        if (element) {
            if (element._wblockRevokeUrl) {
                try { URL.revokeObjectURL(element._wblockRevokeUrl); } catch (e) { /* ignore */ }
                element._wblockRevokeUrl = null;
            }
            if (element.parentNode) {
                try { element.remove(); } catch (e) { /* ignore */ }
            }
        }
        if (video._wblockChaptersBlobUrl) {
            try { URL.revokeObjectURL(video._wblockChaptersBlobUrl); } catch (e) { /* ignore */ }
        }
        video._wblockChaptersElement = null;
        video._wblockChaptersBlobUrl = null;
        video._wblockChaptersTrack = null;
        video._wblockChapterApplyKey = null;
        video._wblockChapterDuration = null;
    }

    function hideAndRevokeChapterTrack(element) {
        hideChapterTrack(element);
        var stale = element && element._wblockRevokeUrl;
        if (element) element._wblockRevokeUrl = null;
        if (stale) {
            try { URL.revokeObjectURL(stale); } catch (e) { /* ignore */ }
        }
    }

    function installChapterTrack(video, vtt) {
        if (!window.Blob || !URL.createObjectURL) {
            warn('chapter track blobs unavailable');
            return false;
        }
        var blobUrl;
        try {
            blobUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
        } catch (e) {
            warn('chapter blob URL failed', e);
            return false;
        }
        var element = video._wblockChaptersElement;
        var previousUrl = video._wblockChaptersBlobUrl;
        if (!element || !element.isConnected) {
            element = document.createElement('track');
            element.kind = 'chapters';
            element.label = 'Chapters';
            element.srclang = 'en';
            element.default = true;
            element.setAttribute('data-wblock-native-chapters', '1');
            element.addEventListener('load', function () { hideAndRevokeChapterTrack(element); });
            try {
                video.appendChild(element);
            } catch (e) {
                try { URL.revokeObjectURL(blobUrl); } catch (ignored) { /* ignore */ }
                warn('chapter track attach failed', e);
                return false;
            }
            video._wblockChaptersElement = element;
        } else if (previousUrl) {
            element._wblockRevokeUrl = previousUrl;
        }
        element.src = blobUrl;
        hideChapterTrack(element);
        video._wblockChaptersBlobUrl = blobUrl;
        video._wblockChaptersTrack = element.track;
        return true;
    }

    // Mirror YouTube's chapters onto the native element as a chapters track.
    // YouTube may discard or replace ytInitialData after player startup, so a
    // successful extraction is cached on the video and reused by later media
    // events. Never erase working cues merely because a subsequent lookup is
    // temporarily empty; only clear them when the current video id changes.
    function applyChapters(video) {
        if (!video) return false;
        var videoId = currentChapterVideoId();
        var source = chapterDataSource();
        var chapters = extractChapters(source);
        var fingerprint = chapters ? JSON.stringify(chapters) : '[]';
        var sourceIsFromPreviousVideo = !!(chapters && chapters.length &&
            ((video._wblockChapterVideoId && video._wblockChapterVideoId !== videoId &&
                video._wblockChapterFingerprint === fingerprint) ||
             (video._wblockRejectedChapterFingerprint === fingerprint &&
                video._wblockRejectedChapterVideoId === videoId)));

        if (chapters && chapters.length && !sourceIsFromPreviousVideo) {
            video._wblockChapterData = chapters;
            video._wblockChapterVideoId = videoId;
            video._wblockChapterDataSource = source;
            video._wblockChapterFingerprint = fingerprint;
            video._wblockRejectedChapterFingerprint = null;
            video._wblockRejectedChapterVideoId = null;
        } else if (video._wblockChapterVideoId === videoId &&
            video._wblockChapterData && video._wblockChapterData.length) {
            chapters = video._wblockChapterData;
            fingerprint = video._wblockChapterFingerprint || JSON.stringify(chapters);
        } else {
            removeChapterTrack(video);
            video._wblockChapterData = null;
            video._wblockChapterVideoId = videoId;
            video._wblockChapterDataSource = source;
            video._wblockChapterFingerprint = fingerprint;
            if (sourceIsFromPreviousVideo) {
                video._wblockRejectedChapterFingerprint = fingerprint;
                video._wblockRejectedChapterVideoId = videoId;
            }
            return false;
        }

        var duration = (isFinite(video.duration) && video.duration > 0) ? video.duration : null;
        var applyKey = fingerprint + '|' + (duration === null ? '' : String(duration));
        if (video._wblockChaptersElement && video._wblockChaptersElement.isConnected &&
            video._wblockChapterApplyKey === applyKey) {
            hideChapterTrack(video._wblockChaptersElement);
            return true;
        }

        var built = chaptersToWebVtt(chapters, duration);
        if (!built.added) {
            removeChapterTrack(video);
            return false;
        }
        if (!installChapterTrack(video, built.vtt)) return false;
        video._wblockChapterApplyKey = applyKey;
        video._wblockChapterDuration = duration;
        log('applied', built.added, 'chapters');
        return true;
    }

    function setupChapters(player, video) {
        if (!video) return;
        var attempts = 0;
        var timer = null;

        function stopRetry() {
            if (timer !== null) {
                clearInterval(timer);
                timer = null;
            }
        }

        // Duration is only known once metadata loads; re-apply from the cached
        // chapter list so the final cue ends at the real media duration.
        function onLoadedMetadata() {
            if (applyChapters(video)) stopRetry();
        }
        video.addEventListener('loadedmetadata', onLoadedMetadata);

        function onYouTubeData() {
            if (applyChapters(video)) stopRetry();
        }
        document.addEventListener('yt-page-data-updated', onYouTubeData, true);
        document.addEventListener('yt-navigate-finish', onYouTubeData, true);

        if (!applyChapters(video)) {
            // Watch/SPA chapter lists often land after the player is already
            // nativeized. Keep retrying through the usual YouTube hydration
            // window instead of giving up after a few seconds.
            timer = setInterval(function () {
                attempts++;
                if (applyChapters(video) || attempts >= 40) { stopRetry(); }
            }, 250);
        }

        registerCleanup(function () {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            document.removeEventListener('yt-page-data-updated', onYouTubeData, true);
            document.removeEventListener('yt-navigate-finish', onYouTubeData, true);
            stopRetry();
            removeChapterTrack(video);
        });
    }

    // ------------------------------------------------------------------
    // Native subtitles
    //
    // Safari exposes <track kind="subtitles"> entries in its native language
    // menu. YouTube publishes signed timed-text URLs in the player response, so
    // convert the usable WebVTT responses to blob-backed tracks without adding
    // another custom control. Some WEB caption URLs now require a Proof-of-
    // Origin token and return an empty HTTP 200; for those, request caption
    // metadata through YouTube's token-free Android VR client first.
    // ------------------------------------------------------------------

    function youtubeText(value) {
        if (!value) return '';
        if (value.simpleText) return value.simpleText;
        if (value.runs && value.runs.length) {
            var text = '';
            for (var i = 0; i < value.runs.length; i++) text += value.runs[i].text || '';
            return text;
        }
        return '';
    }

    function captionTracksFromResponse(response) {
        try {
            var renderer = response && response.captions && response.captions.playerCaptionsTracklistRenderer;
            return renderer && Array.isArray(renderer.captionTracks) ? renderer.captionTracks.slice(0, 24) : [];
        } catch (e) { return []; }
    }

    function currentCaptionTracks(player) {
        var response = null;
        try {
            if (player && typeof player.getPlayerResponse === 'function') response = player.getPlayerResponse();
        } catch (e) { /* fall back */ }
        var tracks = captionTracksFromResponse(response);
        if (!tracks.length) tracks = captionTracksFromResponse(window.ytInitialPlayerResponse);
        return tracks;
    }

    function youtubeConfigValue(key) {
        try {
            if (window.ytcfg && typeof window.ytcfg.get === 'function') {
                var value = window.ytcfg.get(key);
                if (value !== undefined && value !== null) return value;
            }
            if (window.ytcfg && window.ytcfg.data_ && window.ytcfg.data_[key] !== undefined) {
                return window.ytcfg.data_[key];
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function nativeSubtitleVideoId(player) {
        var id = sponsorBlockVideoId();
        if (id) return id;
        try {
            var data = player && typeof player.getVideoData === 'function' ? player.getVideoData() : null;
            if (data && data.video_id) return String(data.video_id);
        } catch (e) { /* ignore */ }
        return null;
    }

    function captionUrl(track) {
        if (!track || !track.baseUrl) return null;
        try {
            var url = new URL(track.baseUrl, location.href);
            url.searchParams.set('fmt', 'vtt');
            return url.href;
        } catch (e) { return null; }
    }

    function captionsNeedAlternateClient(tracks) {
        for (var i = 0; i < tracks.length; i++) {
            try {
                var url = new URL(tracks[i].baseUrl, location.href);
                if (url.searchParams.get('exp') === 'xpe' && !url.searchParams.get('pot')) return true;
            } catch (e) { /* try the normal URL */ }
        }
        return false;
    }

    function alternateCaptionTracks(videoId, signal) {
        var apiKey = youtubeConfigValue('INNERTUBE_API_KEY');
        if (!apiKey || !videoId) return Promise.resolve([]);
        var visitorData = youtubeConfigValue('VISITOR_DATA');
        if (!visitorData) {
            var context = youtubeConfigValue('INNERTUBE_CONTEXT');
            visitorData = context && context.client && context.client.visitorData;
        }
        var client = {
            clientName: 'ANDROID_VR', clientVersion: '1.65.10', deviceMake: 'Oculus', deviceModel: 'Quest 3',
            androidSdkVersion: 32, osName: 'Android', osVersion: '12L',
            userAgent: 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L) gzip'
        };
        if (visitorData) client.visitorData = visitorData;
        var headers = {
            'Content-Type': 'application/json',
            'X-YouTube-Client-Name': '28',
            'X-YouTube-Client-Version': client.clientVersion
        };
        if (visitorData) headers['X-Goog-Visitor-Id'] = visitorData;
        return fetch('/youtubei/v1/player?key=' + encodeURIComponent(apiKey) + '&prettyPrint=false', {
            method: 'POST', credentials: 'same-origin', signal: signal,
            headers: headers,
            body: JSON.stringify({
                context: { client: client }, videoId: videoId,
                contentCheckOk: true, racyCheckOk: true
            })
        }).then(function (response) {
            if (!response.ok) return null;
            return response.json();
        }).then(captionTracksFromResponse).catch(function () { return []; });
    }

    function downloadNativeSubtitleTracks(tracks, signal) {
        return Promise.all(tracks.map(function (track) {
            var url = captionUrl(track);
            if (!url) return Promise.resolve(null);
            return fetch(url, { credentials: 'same-origin', signal: signal }).then(function (response) {
                if (!response.ok) return '';
                return response.text();
            }).then(function (text) {
                text = String(text || '').replace(/^\uFEFF/, '');
                if (text.slice(0, 6) !== 'WEBVTT' || text.indexOf('-->') === -1 || text.length > 5000000) return null;
                return { definition: track, vtt: text };
            }).catch(function () { return null; });
        })).then(function (results) {
            return results.filter(function (result) { return !!result; });
        });
    }

    function setupNativeSubtitles(player, video) {
        if (!player || !video || !window.fetch || !window.Blob || !URL.createObjectURL) return;
        var cancelled = false;
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var retryTimer = null;
        var attempts = 0;
        var started = false;
        var elements = [];
        var blobUrls = [];

        // Safari's CC menu only lists real subtitle tracks. YouTube's caption
        // overlay sits under the native <video>, so clicking its hidden CC
        // button cannot show text. Install downloaded WebVTT and let Safari
        // toggle it. Videos with no usable captions get no tracks at all.
        function stopRetry() {
            if (retryTimer !== null) clearInterval(retryTimer);
            retryTimer = null;
        }

        function install(downloads) {
            if (cancelled || !downloads.length) return;
            var seen = {};
            for (var i = 0; i < downloads.length; i++) {
                var definition = downloads[i].definition;
                var language = definition.languageCode || '';
                var label = youtubeText(definition.name) || language || 'CC';
                var key = definition.vssId || language + '|' + label;
                if (seen[key]) continue;
                seen[key] = true;
                try {
                    var blobUrl = URL.createObjectURL(new Blob([downloads[i].vtt], { type: 'text/vtt' }));
                    var element = document.createElement('track');
                    element.kind = 'subtitles';
                    element.label = label;
                    element.srclang = language;
                    element.src = blobUrl;
                    element.setAttribute('data-wblock-native-subtitle', key);
                    video.appendChild(element);
                    elements.push(element);
                    blobUrls.push(blobUrl);
                } catch (e) { /* skip one malformed track */ }
            }
            if (elements.length) log('applied', elements.length, 'Safari caption tracks');
        }

        function loadTracks(tracks) {
            var signal = controller ? controller.signal : undefined;
            var videoId = nativeSubtitleVideoId(player);
            var useAlternateFirst = captionsNeedAlternateClient(tracks);
            var candidates = useAlternateFirst ? alternateCaptionTracks(videoId, signal) : Promise.resolve(tracks);
            candidates.then(function (candidateTracks) {
                if (cancelled) return [];
                return downloadNativeSubtitleTracks(candidateTracks.length ? candidateTracks : tracks, signal);
            }).then(function (downloads) {
                if (cancelled || downloads.length || useAlternateFirst) return downloads;
                return alternateCaptionTracks(videoId, signal).then(function (alternate) {
                    return downloadNativeSubtitleTracks(alternate, signal);
                });
            }).then(function (downloads) {
                if (!cancelled && downloads) install(downloads);
            }).catch(function (error) {
                if (!cancelled && (!error || error.name !== 'AbortError')) log('native subtitles unavailable', error);
            });
        }

        function tryStart() {
            if (started || cancelled) return;
            var tracks = currentCaptionTracks(player);
            if (!tracks.length) return;
            started = true;
            stopRetry();
            loadTracks(tracks);
        }

        tryStart();
        if (!started) {
            retryTimer = setInterval(function () {
                attempts++;
                tryStart();
                if (attempts >= 10) stopRetry();
            }, 500);
        }

        registerCleanup(function () {
            cancelled = true;
            stopRetry();
            if (controller) controller.abort();
            for (var i = 0; i < elements.length; i++) {
                if (elements[i].parentNode) elements[i].remove();
            }
            for (var j = 0; j < blobUrls.length; j++) {
                try { URL.revokeObjectURL(blobUrls[j]); } catch (e) { /* ignore */ }
            }
        });
    }

    // Home/search hover-to-play mounts a tiny html5 player over a thumbnail.
    // Nativeizing it steals the active player, flashes Safari chrome on cards,
    // and makes the real watch/Shorts player look like it never injected.
    function isHoverPreviewPlayer(node) {
        if (!node || node.nodeType !== 1) return false;
        try {
            if (node.closest && node.closest(
                'ytd-video-preview, ytd-thumbnail, ytd-moving-thumbnail-renderer, ' +
                '#video-preview, #preview, #preview-player, .ytp-inline-preview-ui'
            )) {
                return true;
            }
            var identity = String(node.id || '') + ' ' + String(node.className || '') +
                ' ' + String(node.tagName || '');
            return /(?:video-preview|inline-preview|hover-preview|moving-thumbnail)/i.test(identity);
        } catch (e) { return false; }
    }

    function findPlayer() {
        var candidates = [];
        function add(raw) {
            if (!raw) return;
            var player = raw.matches && raw.matches('.html5-video-player') ? raw :
                (raw.querySelector && raw.querySelector('.html5-video-player')) || raw;
            if (!player.querySelector || !player.querySelector('video')) return;
            if (candidates.indexOf(player) === -1) { candidates.push(player); }
        }

        var known = document.querySelectorAll('#movie_player, .html5-video-player');
        for (var i = 0; i < known.length; i++) {
            if (!isHoverPreviewPlayer(known[i])) { add(known[i]); }
        }
        if (!candidates.length) {
            var wrappers = document.querySelectorAll('ytd-player, ytm-player, #player-container');
            for (var w = 0; w < wrappers.length; w++) {
                if (!isHoverPreviewPlayer(wrappers[w])) { add(wrappers[w]); }
            }
        }
        if (!candidates.length) return null;
        if (candidates.length === 1) return candidates[0];
        var visiblePlaying = null;
        for (var p = 0; p < candidates.length; p++) {
            if (candidates[p].classList.contains('playing-mode') &&
                candidates[p].getAttribute('aria-hidden') !== 'true' && !candidates[p].hidden) {
                if (visiblePlaying) { visiblePlaying = null; break; }
                visiblePlaying = candidates[p];
            }
        }
        if (visiblePlaying) return visiblePlaying;

        // Desktop Shorts can retain multiple player instances. Prefer the
        // visible, initialized, currently-playing one instead of the first DOM
        // match, which is commonly an offscreen previous Short.
        var best = candidates[0];
        var bestScore = -Infinity;
        for (var c = 0; c < candidates.length; c++) {
            var candidate = candidates[c];
            var video = candidate.querySelector('video');
            var score = 0;
            try {
                if (candidate.getAttribute('aria-hidden') === 'true' || candidate.hidden) { score -= 200; }
                if (candidate.classList.contains('playing-mode')) { score += 80; }
                if (video.currentSrc || video.src) { score += 30; }
                if (video.readyState > 0) { score += 30; }
                if (!video.paused && !video.ended) { score += 100; }
                var rect = candidate.getBoundingClientRect();
                if (rect.width > 1 && rect.height > 1 &&
                    rect.bottom > 0 && rect.right > 0 &&
                    rect.top < window.innerHeight && rect.left < window.innerWidth) {
                    score += 60;
                }
                var style = getComputedStyle(candidate);
                if (style.display === 'none' || style.visibility === 'hidden') { score -= 200; }
            } catch (e) { /* keep the structural score */ }
            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }
        return best;
    }

    function isShortsPath() {
        return /^\/shorts(?:\/|$)/.test(location.pathname);
    }

    // Users asked for YouTube's stock Shorts experience: the Shorts UI
    // (action rail, subscribe row, sound picker, tap gestures) is built
    // around YouTube's own player chrome, so nativeizing the reel player
    // does more harm than good there. On /shorts paths the stylesheet is
    // suspended and any nativeized player is fully released; navigating
    // back to a regular page re-enables everything pre-paint.
    var shortsSuspensionComplete = false;

    function setStylesSuspended(suspended) {
        var style = document.getElementById(STYLE_ID);
        if (style && style.disabled !== suspended) { style.disabled = suspended; }
    }

    function suspendForShorts() {
        // The stylesheet can appear after the first suspension pass (the
        // document observer injects it pre-paint), so re-disable it cheaply
        // on every call.
        setStylesSuspended(true);
        if (shortsSuspensionComplete) return;
        shortsSuspensionComplete = true;
        if (playerObserver) {
            try { playerObserver.disconnect(); } catch (e) { /* ignore */ }
            playerObserver = null;
        }
        var released = activeVideo;
        if (released) {
            releaseActiveVideo();
            // Teardown keeps the forced controls attribute; strip it so
            // Safari's native bar does not cover the Shorts UI.
            try { released.removeAttribute('controls'); } catch (e) { /* ignore */ }
        }
        var marked = document.querySelectorAll('.wblock-tc-native, [' + ATTR_CLEANED + ']');
        for (var i = 0; i < marked.length; i++) {
            marked[i].classList.remove('wblock-tc-native');
            marked[i].removeAttribute(ATTR_CLEANED);
        }
    }

    function transformPlayer() {
        if (isShortsPath()) {
            suspendForShorts();
            return;
        }
        setStylesSuspended(false);
        shortsSuspensionComplete = false;

        var player = findPlayer();
        if (!player) return;

        var video = player.querySelector('video');
        if (!video) return;
        if (isHoverPreviewPlayer(player) || isHoverPreviewPlayer(video)) return;

        // Check if we already processed this video.
        var videoId = youtubeVideoIdentity(player) || '';
        if (player.getAttribute(ATTR_CLEANED) === videoId && activeVideo === video) return;
        player.setAttribute(ATTR_CLEANED, videoId);

        log('transforming player for', videoId || '(unknown)');

        // 1. Mark the video as native by adding a wrapper class
        player.classList.add('wblock-tc-native');

        // 2-5. Apply all per-video enhancements (native controls, PiP/inline
        // attributes, controls guard, toolbar, auto-PiP).
        // activateVideo first tears down the previous video's resources so
        // nothing leaks across SPA navigations.
        activateVideo(player, video);

        // 6. Apply audio-only preference on desktop only. Hiding the <video>
        // on iOS also hides Safari's native controls, and the mode never reduced
        // SABR video transfer in the first place. Clear old persisted state so
        // users cannot remain trapped on a black, non-interactive player.
        if (IS_IOS) {
            if (isAudioOnly()) { setAudioOnly(false); }
            setAudioOnlyStyles(false);
        } else {
            setAudioOnlyStyles(isAudioOnly());
        }

        // 7. Enable background playback
        enableBackgroundPlayback();

        // 8. Fixed quality ranges can stall YouTube's SABR pipeline on iOS.
        // Migrate old mobile state back to adaptive and never retry it during
        // startup. The mobile quality selector applies choices only on demand
        // to the current video.
        if (IS_IOS) {
            if (getPreferredQuality() !== 'auto') { setPreferredQuality('auto'); }
            try { localStorage.removeItem('yt-player-quality'); } catch (e) { /* ignore */ }
        } else {
            applyPreferredQuality();
        }

        // 7. Observe for video element recreation. The player element persists
        // across SPA navigations, so disconnect any previous observer before
        // creating a new one to avoid accumulating observers.
        if (playerObserver) {
            try { playerObserver.disconnect(); } catch (e) { /* ignore */ }
        }
        playerObserver = new MutationObserver(function () {
            var newVid = player.querySelector('video');
            if (newVid && newVid !== activeVideo) {
                log('re-patching new video element');
                activateVideo(player, newVid);
            }
        });
        playerObserver.observe(player, { childList: true, subtree: true });

        log('player transformed');
    }

    // ------------------------------------------------------------------
    // Quality control via YouTube's internal player UI
    // ------------------------------------------------------------------

    // YouTube's quality labels match quality strings
    var QUALITY_LABELS = {
        auto: 'Auto',
        hd2160: '4K',
        hd1440: '1440p',
        hd1080: '1080p',
        hd720: '720p',
        large: '480p',
        medium: '360p',
        small: '240p',
        tiny: '144p'
    };

    // Ordered from highest to lowest (excluding 'auto')
    var QUALITY_ORDER = [
        'hd2160', 'hd1440', 'hd1080', 'hd720',
        'large', 'medium', 'small', 'tiny'
    ];

    // A blob: src on the media element is conclusive evidence that the page
    // attached a MediaSource / ManagedMediaSource (Tube Cleaner never assigns
    // blob urls itself). On iOS, tearing that element out of the DOM or
    // overwriting its src with a discovered url wedges YouTube's SABR / MMS
    // pipeline and surfaces as a player that refuses to load until refresh.
    function hasOpaqueMediaSource(video) {
        try {
            return !!(video && ((video.currentSrc || '').indexOf('blob:') === 0 ||
                (video.src || '').indexOf('blob:') === 0));
        } catch (e) { return false; }
    }

    // SABR can initially report only the rendition buffered so far (often
    // 360p), on both mobile and desktop Safari. Treat a standard-definition-
    // only response as incomplete rather than making the picker useless. iOS
    // always gets the ladder because its player commonly reports one temporary
    // rendition even after startup. Reported non-standard levels are retained.
    // Selection stays best-effort and is never persisted at iOS startup, so a
    // stalled choice can always be reverted to Auto from the same menu.
    function qualityMenuLevels() {
        var reported = getAvailableQualities();
        var mediumIndex = QUALITY_ORDER.indexOf('medium');
        var hasHigherRendition = reported.some(function (quality) {
            var index = QUALITY_ORDER.indexOf(quality);
            return index !== -1 && index < mediumIndex;
        });
        var needsCanonicalLadder = IS_IOS || !hasHigherRendition;
        if (!needsCanonicalLadder) { return reported; }

        var seen = {};
        var levels = [];
        for (var i = 0; i < QUALITY_ORDER.length; i++) {
            seen[QUALITY_ORDER[i]] = true;
            levels.push(QUALITY_ORDER[i]);
        }
        for (var j = 0; j < reported.length; j++) {
            if (!seen[reported[j]]) { seen[reported[j]] = true; levels.push(reported[j]); }
        }
        return levels;
    }

    function getAvailableQualities() {
        var player = findPlayer();
        if (!player || !player.getAvailableQualityLevels) return [];
        var levels = player.getAvailableQualityLevels();
        if (!levels || !levels.length) return [];
        // levels is ordered highest-first, may include 'auto'
        return levels.filter(function (q) { return q && q !== 'auto'; });
    }

    function getCurrentQuality() {
        var player = findPlayer();
        if (!player || !player.getPlaybackQuality) return 'auto';
        var q = player.getPlaybackQuality();
        return q || 'auto';
    }

    // Click YouTube's internal settings button to open the quality menu
    function openSettingsMenu(player) {
        var settingsBtn = player.querySelector('.ytp-settings-button') ||
            player.querySelector('[aria-label="Settings"]') ||
            player.querySelector('.ytp-button[aria-label*="Settings"]');
        if (!settingsBtn) { warn('openSettings: no settings button'); return false; }
        var expanded = settingsBtn.getAttribute('aria-expanded') === 'true' ||
            player.classList.contains('ytp-settings-menu-open');
        if (!expanded) { settingsBtn.click(); }
        return true;
    }

    // Find the quality menu item in the settings panel
    function clickQualityMenuItem(player) {
        var menuItems = player.querySelectorAll('.ytp-menuitem');
        for (var i = 0; i < menuItems.length; i++) {
            var item = menuItems[i];
            var content = item.querySelector('.ytp-menuitem-content');
            if (content && content.textContent && content.textContent.match(/\d{3,}/)) {
                // This is the quality menu item (has resolution numbers)
                item.click();
                return true;
            }
        }
        // Alternative: look for the label
        for (var j = 0; j < menuItems.length; j++) {
            var label = menuItems[j].querySelector('.ytp-menuitem-label');
            if (label && label.textContent && label.textContent.toLowerCase().indexOf('quality') !== -1) {
                menuItems[j].click();
                return true;
            }
        }
        return false;
    }

    // Click a specific quality option in the quality submenu
    function clickQualityOption(player, target) {
        var targetLabel = QUALITY_LABELS[target] || target;
        // Try to find by quality label text (e.g. "1080p", "720p")
        var allOptions = player.querySelectorAll('.ytp-quality-menu .ytp-menuitem, ' +
            '.ytp-drop-down-menu-button, [role="menuitemradio"], ' +
            '.ytp-panel-menu .ytp-menuitem');

        // Look for the label that matches our target
        var items = [];
        for (var i = 0; i < allOptions.length; i++) items.push(allOptions[i]);

        // Sort: prefer exact match, then partial match
        var bestMatch = null;
        var bestScore = -1;
        for (var j = 0; j < items.length; j++) {
            var text = items[j].textContent || '';
            var score = 0;
            if (text.indexOf(targetLabel) !== -1) score = 2;
            else if (text.indexOf(target) !== -1) score = 1;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = items[j];
            }
        }

        if (bestMatch && bestScore > 0) {
            log('clicking quality option:', bestMatch.textContent);
            bestMatch.click();
            return true;
        }

        return false;
    }

    // Close the settings panel
    function closeSettingsPanel(player) {
        var backBtn = player.querySelector('.ytp-panel-header button');
        if (backBtn) {
            backBtn.click();
            return true;
        }
        // Click the settings button again to toggle it closed
        var settingsBtn = player.querySelector('.ytp-settings-button');
        if (settingsBtn) {
            settingsBtn.click();
        }
        return false;
    }

    var qualityGeneration = 0;
    var qualityRequest = null;

    function cancelQualityRequest() {
        var request = qualityRequest;
        if (!request) return;
        request.cancelled = true;
        qualityGeneration++;
        for (var i = 0; i < request.timers.length; i++) clearTimeout(request.timers[i]);
        request.timers = [];
        closeSettingsPanel(request.player);
        qualityRequest = null;
        for (var j = 0; j < request.callbacks.length; j++) request.callbacks[j](false);
    }

    function finishQualityRequest(request, worked) {
        if (qualityRequest !== request || request.cancelled || request.generation !== qualityGeneration) return;
        for (var i = 0; i < request.timers.length; i++) clearTimeout(request.timers[i]);
        request.timers = [];
        qualityRequest = null;
        for (var j = 0; j < request.callbacks.length; j++) request.callbacks[j](worked);
    }

    function setQuality(target, callback) {
        var player = findPlayer();
        if (!player || !activeVideo) {
            warn('setQuality: no player');
            if (callback) callback(false);
            return false;
        }
        if (qualityRequest) {
            if (qualityRequest.player === player && qualityRequest.target === target) {
                if (callback) qualityRequest.callbacks.push(callback);
                return true;
            }
            cancelQualityRequest();
        }

        if (target !== 'auto') {
            var levels = qualityMenuLevels();
            if (levels.indexOf(target) === -1) {
                var targetIdx = QUALITY_ORDER.indexOf(target);
                for (var i = targetIdx + 1; i < QUALITY_ORDER.length; i++) {
                    if (levels.indexOf(QUALITY_ORDER[i]) !== -1) {
                        target = QUALITY_ORDER[i];
                        break;
                    }
                }
            }
            log('setQuality:', target, 'available:', levels);
        }

        var request = {
            player: player, video: activeVideo, target: target, generation: ++qualityGeneration,
            cancelled: false, timers: [], callbacks: callback ? [callback] : []
        };
        qualityRequest = request;

        function current() {
            return qualityRequest === request && !request.cancelled &&
                request.generation === qualityGeneration && activeVideo === request.video;
        }
        function later(fn, delay) {
            request.timers.push(setTimeout(function () {
                if (current()) fn();
            }, delay));
        }
        function fallback() {
            if (!current()) return;
            closeSettingsPanel(player);
            var worked = false;
            try {
                if (target === 'auto') {
                    if (player.setPlaybackQualityRange) {
                        player.setPlaybackQualityRange('tiny', 'hd2160');
                        worked = true;
                    }
                    if (getCurrentQuality() !== 'auto' && player.setPlaybackQuality) {
                        player.setPlaybackQuality('auto');
                        worked = true;
                    }
                    if (worked) localStorage.removeItem('yt-player-quality');
                } else if (player.setPlaybackQualityRange) {
                    // Cap the ladder at the chosen quality instead of pinning
                    // a single rendition. Pinning 4K while SABR is still on a
                    // lower startup stream forces a hard reload.
                    player.setPlaybackQualityRange('tiny', target);
                    worked = true;
                    if (player.setPlaybackQuality) { player.setPlaybackQuality(target); }
                } else if (player.setPlaybackQuality) {
                    player.setPlaybackQuality(target);
                    worked = true;
                }
            } catch (e) { log('quality API fallback failed', e); }
            if (worked && target !== 'auto' && !IS_IOS) {
                try {
                    localStorage.setItem('yt-player-quality', JSON.stringify({
                        quality: target, previousQuality: 'auto', expiry: Date.now() + 86400000
                    }));
                } catch (e) { /* ignore */ }
            }
            finishQualityRequest(request, worked);
        }

        // The YouTube menu is authoritative for SABR. API calls are used only
        // after a menu step is unavailable or fails, never in parallel with it.
        try {
            if (!openSettingsMenu(player)) { fallback(); return true; }
            later(function () {
                if (!clickQualityMenuItem(player)) { fallback(); return; }
                later(function () {
                    if (!clickQualityOption(player, target)) { fallback(); return; }
                    later(function () {
                        closeSettingsPanel(player);
                        finishQualityRequest(request, true);
                    }, 100);
                }, 200);
            }, 200);
        } catch (e) {
            warn('quality UI failed', e);
            fallback();
        }
        return true;
    }

    function applyPreferredQuality() {
        var preferred = getPreferredQuality();
        if (preferred === 'auto') return;
        var player = findPlayer();
        if (!player || !player.setPlaybackQualityRange) return;
        // Cap SABR at the saved quality. Do not click the settings menu or pin
        // a single rendition: either one restarts the stream when 4K is still
        // warming up from a lower startup ladder.
        try { player.setPlaybackQualityRange('tiny', preferred); }
        catch (e) { /* ignore */ }
    }

    // ------------------------------------------------------------------
    // Toolbar overlay (playback controls plus SponsorBlock and DeArrow settings)
    // ------------------------------------------------------------------

    // The player establishes a containing/stacking context on mobile Safari,
    // which can clip even position:fixed children to its small inline frame.
    // Portal open menus to <body> so they are genuine page overlays and can use
    // the whole YouTube viewport.
    function showMobilePageOverlay(menu, maxHeight) {
        if (!IS_IOS || !menu || !document.body) { return; }
        if (menu.parentNode !== document.body) { document.body.appendChild(menu); }
        menu.style.position = 'fixed';
        menu.style.top = 'auto';
        menu.style.right = '8px';
        menu.style.bottom = 'max(8px, env(safe-area-inset-bottom, 0px))';
        menu.style.marginBottom = '0';
        // Let short menus end at their final control. max-height reserves
        // scrolling only for a panel that genuinely exceeds the viewport.
        menu.style.height = 'auto';
        menu.style.maxHeight = 'min(' + maxHeight + 'px, calc(100vh - 16px))';
        menu.style.maxHeight = 'min(' + maxHeight + 'px, calc(100dvh - 16px))';
        // A short/landscape phone can still be smaller than a full panel.
        // Keep scrolling inside the overlay rather than growing it off-screen.
        menu.style.overflowY = 'auto';
        menu.style.webkitOverflowScrolling = 'touch';
        menu.style.overscrollBehavior = 'contain';
        menu.style.zIndex = '2147483647';
    }

    function removeMobilePageOverlay(menu) {
        if (IS_IOS && menu && menu.parentNode === document.body) { menu.remove(); }
    }

    function toolbarBoxStyle() {
        var opacity = IS_IOS ? '1' : '0.75';
        var font = IS_IOS ? '14px' : '11px';
        var bottom = IS_IOS ? 'calc(56px + env(safe-area-inset-bottom, 0px))' : '42px';
        var right = IS_IOS ? 'max(8px, env(safe-area-inset-right, 0px))' : '8px';
        var edges = 'bottom:' + bottom + ';right:' + right + ';top:auto;left:auto';
        return 'position:absolute;' + edges + ';z-index:2147483646;display:flex;flex-direction:column;gap:6px;align-items:flex-end' +
            ';pointer-events:auto;font:' + font + '/1.2 -apple-system,system-ui,sans-serif;opacity:' +
            opacity + ';transition:opacity 0.15s';
    }

    function placeDesktopAnchoredMenu(menu, options) {
        options = options || {};
        menu.style.position = 'absolute';
        menu.style.height = 'auto';
        menu.style.maxHeight = options.maxHeight || '60vh';
        menu.style.top = 'auto';
        menu.style.bottom = '100%';
        menu.style.left = options.upLeft || 'auto';
        menu.style.right = options.upRight || '0';
        menu.style.marginTop = '0';
        menu.style.marginBottom = options.gap || '4px';
    }

    function buildToolbar(player, video) {
        var existing = player.querySelector('.wblock-tc-toolbar');
        if (existing) {
            if (existing._wblockQualityTimer) clearInterval(existing._wblockQualityTimer);
            existing.remove();
        }

        var toolbar = document.createElement('div');
        toolbar.className = 'wblock-tc-toolbar';
        // Watch pages sit above Safari's native control strip at the
        // bottom-right. The mobile toolbar auto-hides and reappears on a
        // tap to the video surface. (Shorts never builds a toolbar; the
        // cleaner is fully suspended there.)
        toolbar.style.cssText = toolbarBoxStyle();

        var btnStyle = 'background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;-webkit-user-select:none;user-select:none';
        // On iOS, use larger touch targets (minimum 44pt)
        if (IS_IOS) {
            btnStyle = 'background:rgba(0,0,0,0.78);color:#fff;border:none;border-radius:8px;padding:8px 12px;min-width:44px;min-height:44px;font-size:14px;cursor:pointer;-webkit-user-select:none;user-select:none;touch-action:manipulation';
        }
        var playbackRow = document.createElement('div');
        playbackRow.className = 'wblock-tc-playback-row';
        var rowJustify = 'flex-end';
        playbackRow.style.cssText = 'display:flex;gap:6px;align-items:center;justify-content:' + rowJustify;
        var servicesRow = document.createElement('div');
        servicesRow.className = 'wblock-tc-services-row';
        servicesRow.style.cssText = 'display:flex;gap:6px;align-items:center;justify-content:' + rowJustify;
        toolbar.appendChild(playbackRow);
        toolbar.appendChild(servicesRow);

        // Quality selector
        var qualityBtn = document.createElement('button');
        qualityBtn.className = 'wblock-tc-quality-button';
        qualityBtn.type = 'button';
        qualityBtn.style.cssText = btnStyle;
        function updateQualityBtn() {
            var current = getCurrentQuality();
            var label = QUALITY_LABELS[current] || current;
            qualityBtn.textContent = label;
            qualityBtn.title = 'Video quality (click to change)';
        }
        updateQualityBtn();

        // Quality dropdown — opens away from the toolbar edge.
        var qualityMenu = document.createElement('div');
        qualityMenu.className = 'wblock-tc-quality-menu';
        var menuFont = IS_IOS ? '16px' : '12px';
        var menuPadding = IS_IOS ? '8px 0' : '4px 0';
        var menuMinWidth = IS_IOS ? '140px' : '100px';
        var qualityMenuAnchor = 'bottom:100%;right:0;margin-bottom:4px;';
        qualityMenu.style.cssText = 'position:absolute;' + qualityMenuAnchor + 'box-sizing:border-box;background:rgba(0,0,0,0.92);border-radius:5px;padding:' + menuPadding + ';min-width:' + menuMinWidth + ';max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;z-index:70;font:' + menuFont + '/1.8 -apple-system,system-ui,sans-serif';

        function buildQualityMenu() {
            // Clear safely — avoid innerHTML which triggers TrustedHTML CSP
            while (qualityMenu.firstChild) {
                qualityMenu.removeChild(qualityMenu.firstChild);
            }
            var levels = qualityMenuLevels();
            var preferred = getPreferredQuality();

            var itemPadding = IS_IOS ? '10px 16px' : '4px 12px';
            // Use real buttons rather than clickable divs. In iOS Safari, a
            // video layer can make synthetic click targets unreliable, while
            // buttons retain their touch activation semantics above the player.
            var itemStyle = 'display:block;width:100%;border:0;background:transparent;font:inherit;line-height:inherit;text-align:left;padding:' +
                itemPadding + ';cursor:pointer;color:#fff;white-space:nowrap;-webkit-appearance:none;appearance:none;touch-action:manipulation';

            // Auto option
            var autoItem = document.createElement('button');
            autoItem.type = 'button';
            autoItem.style.cssText = itemStyle;
            autoItem.textContent = 'Auto';
            if (preferred === 'auto') {
                autoItem.style.color = '#4fc3f7';
            }
            autoItem.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                setPreferredQuality('auto');
                setQuality('auto');
                updateQualityBtn();
                qualityMenu.style.display = 'none';
            });
            qualityMenu.appendChild(autoItem);

            // Available quality levels
            for (var i = 0; i < levels.length; i++) {
                (function (q) {
                    var item = document.createElement('button');
                    item.type = 'button';
                    item.style.cssText = itemStyle;
                    item.textContent = QUALITY_LABELS[q] || q;
                    if (preferred === q) {
                        item.style.color = '#4fc3f7';
                    }
                    item.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        // On iOS apply the choice to this video only. Persisted
                        // fixed ranges can wedge the next SABR stream at load.
                        if (!IS_IOS) { setPreferredQuality(q); }
                        setQuality(q);
                        updateQualityBtn();
                        qualityMenu.style.display = 'none';
                    });
                    qualityMenu.appendChild(item);
                })(levels[i]);
            }
        }

        qualityBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            // if (sponsorMenu) {
            //     sponsorMenu.style.display = 'none';
            //     if (sponsorBtn) sponsorBtn.setAttribute('aria-expanded', 'false');
            // }
            // if (deArrowMenu) {
            //     deArrowMenu.style.display = 'none';
            //     if (deArrowBtn) deArrowBtn.setAttribute('aria-expanded', 'false');
            // }
            if (qualityMenu.style.display === 'none') {
                buildQualityMenu();
                if (IS_IOS) {
                    showMobilePageOverlay(qualityMenu, 520);
                } else {
                    placeDesktopAnchoredMenu(qualityMenu, { maxHeight: '60vh', gap: '4px' });
                }
                qualityMenu.style.display = 'block';
            } else {
                qualityMenu.style.display = 'none';
            }
        });

        // Close menu on outside click
        function onDocumentClick() {
            qualityMenu.style.display = 'none';
        }
        document.addEventListener('click', onDocumentClick);
        registerCleanup(function () {
            document.removeEventListener('click', onDocumentClick);
        });

        var qualityWrap = document.createElement('div');
        qualityWrap.style.cssText = 'position:relative';
        qualityWrap.appendChild(qualityBtn);
        qualityWrap.appendChild(qualityMenu);
        playbackRow.appendChild(qualityWrap);

        // Update quality label periodically. Store the timer on the toolbar so
        // it can be cleared when the toolbar is rebuilt (avoids a leak across
        // video-element re-creation).
        toolbar._wblockQualityTimer = setInterval(updateQualityBtn, 2000);
        registerCleanup(function () {
            if (toolbar._wblockQualityTimer) {
                clearInterval(toolbar._wblockQualityTimer);
                toolbar._wblockQualityTimer = null;
            }
        });

        // Audio-only toggle
        var audioBtn = document.createElement('button');
        audioBtn.className = 'wblock-tc-audio-button';
        audioBtn.type = 'button';
        audioBtn.style.cssText = btnStyle;
        function updateAudioBtn() {
            audioBtn.textContent = isAudioOnly() ? 'Video' : 'Audio';
            audioBtn.title = isAudioOnly() ? 'Switch to video mode' : 'Switch to audio-only mode';
        }
        updateAudioBtn();
        audioBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var next = !isAudioOnly();
            setAudioOnly(next);
            setAudioOnlyStyles(next);
            updateAudioBtn();
        });
        if (!IS_IOS) { playbackRow.appendChild(audioBtn); }

        // PiP button is intentionally omitted — Safari's native controls
        // already provide PiP. Auto PiP handles automatic PiP entry.

        if (IS_IOS) {
            // The mobile toolbar auto-hides a few seconds after playback
            // resumes and reappears on a tap to the video surface, mirroring
            // Safari's own control-chrome behavior. It stays visible while a
            // settings panel is open and while the video is paused. Native iOS
            // media controls occupy the bottom strip, but taps on the rest of
            // the video bubble through to the element's own click listener.
            var toolbarTimer = null;
            var TOOLBAR_HIDE_DELAY = 3000;

            function showToolbar() {
                toolbar.style.opacity = '1';
                toolbar.style.setProperty('pointer-events', 'auto', 'important');
                clearTimeout(toolbarTimer);
            }
            function hideToolbar() {
                // Never hide while a settings panel is open — the controls
                // that opened it must remain reachable to close it again.
                var panels = [qualityMenu];
                var anyOpen = panels.some(function (p) {
                    return p && p.style.display !== 'none' && p.style.display !== '';
                });
                if (anyOpen) { scheduleHideToolbar(); return; }
                toolbar.style.opacity = '0';
                toolbar.style.setProperty('pointer-events', 'none', 'important');
            }
            function scheduleHideToolbar() {
                clearTimeout(toolbarTimer);
                toolbarTimer = setTimeout(hideToolbar, TOOLBAR_HIDE_DELAY);
            }

            function isToolbarVisible() {
                return toolbar.style.opacity === '1';
            }

            // Tap the video surface to toggle the toolbar.
            function onVideoTap(e) {
                // Let taps on the toolbar's own buttons reach their handlers;
                // the toolbar is a sibling of the video, not a child, so this
                // listener only fires for taps on the video itself.
                if (isToolbarVisible()) {
                    hideToolbar();
                } else {
                    showToolbar();
                    if (!video.paused && !video.ended) { scheduleHideToolbar(); }
                }
            }
            video.addEventListener('click', onVideoTap);

            // Keep visible while the toolbar itself is being touched.
            toolbar.addEventListener('touchstart', function () {
                showToolbar();
                if (!video.paused && !video.ended) { scheduleHideToolbar(); }
            });

            // Auto-hide shortly after playback starts; show again on pause.
            function onVideoPlay() { scheduleHideToolbar(); }
            function onVideoPause() { showToolbar(); }
            video.addEventListener('play', onVideoPlay);
            video.addEventListener('pause', onVideoPause);

            // Initial state: visible if paused, auto-hide once playing.
            showToolbar();
            if (!video.paused && !video.ended) { scheduleHideToolbar(); }

            registerCleanup(function () {
                clearTimeout(toolbarTimer);
                video.removeEventListener('click', onVideoTap);
                video.removeEventListener('play', onVideoPlay);
                video.removeEventListener('pause', onVideoPause);
            });
        } else {
            // Start hidden on desktop — it appears with native controls
            toolbar.style.opacity = '0';
            toolbar.style.setProperty('pointer-events', 'none', 'important');

            var toolbarTimer = null;
            var TOOLBAR_HIDE_DELAY = 3000;
            var _isOverPlayer = false;
            var _isOverToolbar = false;

            function desktopPanelOpen() {
                var panels = [qualityMenu];
                return panels.some(function (p) {
                    return p && p.style.display !== 'none' && p.style.display !== '';
                });
            }

            function pointOverPlayer(x, y) {
                var rect = player.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    return true;
                }
                var bar = toolbar.getBoundingClientRect();
                return x >= bar.left && x <= bar.right && y >= bar.top && y <= bar.bottom;
            }

            function showToolbar() {
                toolbar.style.opacity = '1';
                toolbar.style.setProperty('pointer-events', 'auto', 'important');
                clearTimeout(toolbarTimer);
            }

            function hideToolbar() {
                if (desktopPanelOpen() || _isOverToolbar || video.paused || video.ended) {
                    showToolbar();
                    return;
                }
                toolbar.style.opacity = '0';
                toolbar.style.setProperty('pointer-events', 'none', 'important');
            }

            function scheduleHideToolbar() {
                if (desktopPanelOpen() || _isOverToolbar || video.paused || video.ended) {
                    showToolbar();
                    return;
                }
                clearTimeout(toolbarTimer);
                toolbarTimer = setTimeout(hideToolbar, TOOLBAR_HIDE_DELAY);
            }

            // Safari's native controls stay up while the pointer is over the
            // video and reappear on any movement after idle hide. The previous
            // enter-edge-only listener never showed the toolbar again if the
            // cursor was already inside the player when the timer fired.
            function onDocumentMouseMove(e) {
                var over = pointOverPlayer(e.clientX, e.clientY);
                if (over) {
                    _isOverPlayer = true;
                    showToolbar();
                    scheduleHideToolbar();
                    return;
                }
                if (_isOverPlayer || _isOverToolbar) {
                    _isOverPlayer = false;
                    if (!desktopPanelOpen() && !_isOverToolbar) { scheduleHideToolbar(); }
                }
            }
            document.addEventListener('mousemove', onDocumentMouseMove);

            function onPlayerMouseEnter() {
                _isOverPlayer = true;
                showToolbar();
                scheduleHideToolbar();
            }
            function onPlayerMouseLeave() {
                _isOverPlayer = false;
                if (!_isOverToolbar) { scheduleHideToolbar(); }
            }
            player.addEventListener('mouseenter', onPlayerMouseEnter);
            player.addEventListener('mouseleave', onPlayerMouseLeave);

            toolbar.addEventListener('mouseenter', function () {
                _isOverToolbar = true;
                showToolbar();
            });

            toolbar.addEventListener('mouseleave', function () {
                _isOverToolbar = false;
                scheduleHideToolbar();
            });

            toolbar.addEventListener('focusin', function () {
                showToolbar();
            });

            function onVideoPlay() { scheduleHideToolbar(); }
            video.addEventListener('play', onVideoPlay);

            function onVideoPause() { showToolbar(); }
            video.addEventListener('pause', onVideoPause);

            var presentationTimer = null;
            function onPresentationModeChange() {
                if (video.webkitPresentationMode === 'picture-in-picture') {
                    showToolbar();
                    clearTimeout(presentationTimer);
                    presentationTimer = setTimeout(hideToolbar, 3000);
                }
            }
            video.addEventListener('webkitpresentationmodechanged', onPresentationModeChange);

            registerCleanup(function () {
                clearTimeout(toolbarTimer);
                clearTimeout(presentationTimer);
                document.removeEventListener('mousemove', onDocumentMouseMove);
                player.removeEventListener('mouseenter', onPlayerMouseEnter);
                player.removeEventListener('mouseleave', onPlayerMouseLeave);
                video.removeEventListener('play', onVideoPlay);
                video.removeEventListener('pause', onVideoPause);
                video.removeEventListener('webkitpresentationmodechanged', onPresentationModeChange);
            });
        }

        // Show on CSS class toggle (for keyboard shortcuts)
        toolbar.classList.add('wblock-tc-toolbar-built');

        player.appendChild(toolbar);
        registerCleanup(function () {
            if (toolbar.parentNode) { toolbar.parentNode.removeChild(toolbar); }
        });
    }

    // ------------------------------------------------------------------
    // SPA navigation handling
    // ------------------------------------------------------------------

    var lastUrl = '';

    function onNavigate() {
        var player = findPlayer();
        var video = player && player.querySelector('video');
        var identity = youtubeVideoIdentity(player) || '';
        if (location.href === lastUrl && (!player ||
            (player.getAttribute(ATTR_CLEANED) === identity && activeVideo === video))) return;
        lastUrl = location.href;

        if (player) {
            player.removeAttribute(ATTR_CLEANED);
            // Never remove wblock-tc-native here. Keeping the native class on
            // the persistent player prevents YouTube chrome flashing while the
            // SPA swaps video/page data.
        }

        transformPlayer();
        // refreshDeArrowBranding();
        setTimeout(transformPlayer, 500);
    }

    function watchNavigation() {
        document.addEventListener('yt-navigate-start', onNavigate, true);
        document.addEventListener('yt-navigate-finish', onNavigate, true);
        try {
            document.addEventListener('yt-page-data-updated', onNavigate, true);
        } catch (e) { /* ignore */ }
        window.addEventListener('popstate', onNavigate, true);
    }

    // ------------------------------------------------------------------
    // F hotkey routed to native fullscreen
    // ------------------------------------------------------------------

    // YouTube's own F shortcut fullscreens the #movie_player container. With
    // the player chrome hidden that just zooms the current inline layout,
    // while the native controls fullscreen button presents Safari's real
    // fullscreen player. Intercept F ahead of YouTube's document handlers
    // (capture phase) and drive the video element's native presentation
    // instead. Typing targets pass through untouched so search boxes and
    // comment fields still receive the keystroke.

    function isTypingTarget(target) {
        if (!target || target.nodeType !== 1) { return false; }
        if (target.isContentEditable) { return true; }
        var tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function toggleNativeFullscreen(video) {
        try {
            if (video.webkitPresentationMode === 'fullscreen' &&
                typeof video.webkitSetPresentationMode === 'function') {
                video.webkitSetPresentationMode('inline');
                return;
            }
            if (video.webkitDisplayingFullscreen === true &&
                typeof video.webkitExitFullscreen === 'function') {
                video.webkitExitFullscreen();
                return;
            }
            var fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
            if (fullscreenElement) {
                if (typeof document.exitFullscreen === 'function') { document.exitFullscreen(); }
                else if (typeof document.webkitExitFullscreen === 'function') { document.webkitExitFullscreen(); }
                return;
            }
            if (typeof video.webkitSupportsPresentationMode === 'function' &&
                video.webkitSupportsPresentationMode('fullscreen') &&
                typeof video.webkitSetPresentationMode === 'function') {
                video.webkitSetPresentationMode('fullscreen');
                return;
            }
            if (typeof video.webkitEnterFullscreen === 'function') {
                video.webkitEnterFullscreen();
            }
        } catch (e) { /* ignore */ }
    }

    function onFullscreenHotkey(event) {
        if (event.ctrlKey || event.metaKey || event.altKey) { return; }
        if (event.key !== 'f' && event.key !== 'F') { return; }
        var video = activeVideo;
        if (!video || !video.isConnected) { return; }
        if (isTypingTarget(event.target)) { return; }
        // Consume key repeats too so YouTube never sees a held F, but only
        // toggle once per press.
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) { toggleNativeFullscreen(video); }
    }

    function setupFullscreenHotkey() {
        document.addEventListener('keydown', onFullscreenHotkey, true);
    }

    // ------------------------------------------------------------------
    // Boot
    // ------------------------------------------------------------------

    var documentPlayerObserver = null;

    function nodeMayContainPlayer(node) {
        if (!node || node.nodeType !== 1) { return false; }
        try {
            if (isHoverPreviewPlayer(node)) { return false; }
            if (node.tagName === 'VIDEO' || node.id === 'movie_player' ||
                node.id === 'player-container' ||
                node.matches('.html5-video-player, ytd-player')) {
                return true;
            }
            return !!node.querySelector('video, #movie_player, .html5-video-player, ytd-player, #player-container');
        } catch (e) { return false; }
    }

    function classMutationOnlyChangesOurClasses(record) {
        if (!record || record.type !== 'attributes' || record.attributeName !== 'class') return false;
        function withoutTubeClasses(value) {
            return String(value || '').split(/\s+/).filter(function (name) {
                return name && name.indexOf('wblock-tc-') !== 0;
            }).join(' ');
        }
        return withoutTubeClasses(record.oldValue) === withoutTubeClasses(record.target.className);
    }

    function observeDocumentForPlayer() {
        if (documentPlayerObserver || typeof MutationObserver === 'undefined') { return; }
        documentPlayerObserver = new MutationObserver(function (records) {
            // The first parser mutation creates <html>; install anti-flash CSS
            // then even when the userscript itself ran before documentElement.
            injectStyles();
            var relevant = false;
            for (var i = 0; i < records.length && !relevant; i++) {
                var record = records[i];
                if (classMutationOnlyChangesOurClasses(record)) continue;
                if (nodeMayContainPlayer(record.target)) { relevant = true; break; }
                for (var j = 0; j < record.addedNodes.length; j++) {
                    if (nodeMayContainPlayer(record.addedNodes[j])) {
                        relevant = true;
                        break;
                    }
                }
            }
            // MutationObserver runs before rendering. Transform now—no polling
            // interval or debounce—so YouTube chrome never reaches next paint.
            if (relevant) { transformPlayer(); }
        });
        try {
            documentPlayerObserver.observe(document, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['id', 'class'],
                attributeOldValue: true
            });
        } catch (e) { /* ignore */ }
    }

    function boot() {
        observeDocumentForPlayer();
        injectStyles();
        enableBackgroundPlayback();
        lastUrl = location.href;
        watchNavigation();
        setupFullscreenHotkey();
        transformPlayer();
        // scheduleDeArrowScan(document);

        // Recovery scans only; normal startup is handled pre-paint above.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', transformPlayer, { once: true });
            window.addEventListener('load', transformPlayer, { once: true });
        }
    }

    boot();

    // Expose debug helpers on window for console testing
    try {
        window.__wblockTubeDebug = {
            getAvailableQualities: getAvailableQualities,
            getCurrentQuality: getCurrentQuality,
            setQuality: setQuality,
            applyPreferredQuality: applyPreferredQuality,
            getPreferredQuality: getPreferredQuality,
            setPreferredQuality: setPreferredQuality,
            QUALITY_LABELS: QUALITY_LABELS,
            getPlayer: findPlayer,
            getChapters: extractChapters,
            applyChapters: function () { applyChapters(activeVideo); },
            inspectPlayer: function () {
                var p = findPlayer();
                if (!p) return 'no player';
                var methods = [];
                for (var k in p) {
                    if (typeof p[k] === 'function' &&
                        (k.indexOf('playback') !== -1 || k.indexOf('Quality') !== -1)) {
                        methods.push(k);
                    }
                }
                return {
                    methods: methods,
                    hasGetAvailableQualityLevels: typeof p.getAvailableQualityLevels === 'function',
                    hasGetAvailableQualityData: typeof p.getAvailableQualityData === 'function',
                    hasSetPlaybackQualityRange: typeof p.setPlaybackQualityRange === 'function',
                    hasSetPlaybackQuality: typeof p.setPlaybackQuality === 'function',
                    hasGetPlaybackQuality: typeof p.getPlaybackQuality === 'function',
                    levels: typeof p.getAvailableQualityLevels === 'function' ? p.getAvailableQualityLevels() : 'N/A',
                    qualityData: typeof p.getAvailableQualityData === 'function' ? p.getAvailableQualityData() : 'N/A',
                    current: typeof p.getPlaybackQuality === 'function' ? p.getPlaybackQuality() : 'N/A'
                };
            }
        };
        log('debug helpers exposed at window.__wblockTubeDebug');
    } catch (e) { /* ignore */ }
})();