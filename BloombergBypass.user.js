// ==UserScript==
// @name         BloombergBypass
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Bypass the paywall on Bloomberg
// @match        https://*.bloomberg.com/*
// @grant        none
// @run-at       document-start
// @license      ISC
// ==/UserScript==

const { log, warn, error, debug } = window.console;

const subs = {
    BLOOMBERG_ALL: 'bbg-all',
    BLOOMBERG_DIGITAL: 'bbg-digital',
    BUSINESSWEEK_PRINT: 'bw-print',
    BUSINESSWEEK_DIGITAL: 'bw-digital',
    BUSINESSWEEK_ZINIO: 'bw-zinio'
};
const subStrings = Object.values(subs);

const _searchParamsGet = URLSearchParams.prototype.get;
URLSearchParams.prototype.get = function get() {
    let params = _searchParamsGet.apply(this, arguments);
    if (arguments[0] === 'mockSub') {
        return 'bbg';
    }
    if (arguments[0] === 'showPaywall') {
        return null;
    }
    return params;
}

const _arraySome = Array.prototype.some;
Array.prototype.some = function some() {
    let includesSubs = false;
    subStrings.forEach(str => {
        if (this.includes(str)) includesSubs = true;
    });
    if (includesSubs) return true;
    return _arraySome.apply(this, arguments);
}

Object.defineProperty(window, '_regUserInfo', {
    get() {
        return window._regUserInfo_;
    },
    set(v) {
        v.subscription = { type: 'BBW' };
        window._regUserInfo_ = v;
    }
});

Object.defineProperties(Object.prototype, {
    _isTerminalSubscriber: {
        get() {
            return true;
        },
        set() {}
    },
    _isBBGSubscriber: {
        get() {
            return true;
        },
        set() {}
    },
    _isBWSubscriber: {
        get() {
            return true;
        },
        set() {}
    }
});