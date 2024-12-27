// ==UserScript==
// @name        uBlockYouTube
// @description uBLock Origin YouTube Scriptlet
// @match       *://*.youtube.com/*
// ==/UserScript==

(function() {
    // >>>> start of private namespace
    
    ;
    
    const scriptletGlobals = {
        "warOrigin": "moz-extension://ad4b652f-1460-4f28-873d-bcee18d1e9e0/web_accessible_resources",
        "warSecret": "mgrze3wg10dr5opgmy"
    }
    
    function safeSelf() {
        if ( scriptletGlobals.safeSelf ) {
            return scriptletGlobals.safeSelf;
        }
        const self = globalThis;
        const safe = {
            'Array_from': Array.from,
            'Error': self.Error,
            'Function_toStringFn': self.Function.prototype.toString,
            'Function_toString': thisArg => safe.Function_toStringFn.call(thisArg),
            'Math_floor': Math.floor,
            'Math_max': Math.max,
            'Math_min': Math.min,
            'Math_random': Math.random,
            'Object': Object,
            'Object_defineProperty': Object.defineProperty.bind(Object),
            'Object_defineProperties': Object.defineProperties.bind(Object),
            'Object_fromEntries': Object.fromEntries.bind(Object),
            'Object_getOwnPropertyDescriptor': Object.getOwnPropertyDescriptor.bind(Object),
            'RegExp': self.RegExp,
            'RegExp_test': self.RegExp.prototype.test,
            'RegExp_exec': self.RegExp.prototype.exec,
            'Request_clone': self.Request.prototype.clone,
            'String_fromCharCode': String.fromCharCode,
            'XMLHttpRequest': self.XMLHttpRequest,
            'addEventListener': self.EventTarget.prototype.addEventListener,
            'removeEventListener': self.EventTarget.prototype.removeEventListener,
            'fetch': self.fetch,
            'JSON': self.JSON,
            'JSON_parseFn': self.JSON.parse,
            'JSON_stringifyFn': self.JSON.stringify,
            'JSON_parse': (...args) => safe.JSON_parseFn.call(safe.JSON, ...args),
            'JSON_stringify': (...args) => safe.JSON_stringifyFn.call(safe.JSON, ...args),
            'log': console.log.bind(console),
            // Properties
            logLevel: 0,
            // Methods
            makeLogPrefix(...args) {
                return this.sendToLogger && `[${args.join(' \u205D ')}]` || '';
            },
            uboLog(...args) {
                if ( this.sendToLogger === undefined ) { return; }
                if ( args === undefined || args[0] === '' ) { return; }
                return this.sendToLogger('info', ...args);
                
            },
            uboErr(...args) {
                if ( this.sendToLogger === undefined ) { return; }
                if ( args === undefined || args[0] === '' ) { return; }
                return this.sendToLogger('error', ...args);
            },
            escapeRegexChars(s) {
                return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            },
            initPattern(pattern, options = {}) {
                if ( pattern === '' ) {
                    return { matchAll: true, expect: true };
                }
                const expect = (options.canNegate !== true || pattern.startsWith('!') === false);
                if ( expect === false ) {
                    pattern = pattern.slice(1);
                }
                const match = /^\/(.+)\/([gimsu]*)$/.exec(pattern);
                if ( match !== null ) {
                    return {
                        re: new this.RegExp(
                            match[1],
                            match[2] || options.flags
                        ),
                        expect,
                    };
                }
                if ( options.flags !== undefined ) {
                    return {
                        re: new this.RegExp(this.escapeRegexChars(pattern),
                            options.flags
                        ),
                        expect,
                    };
                }
                return { pattern, expect };
            },
            testPattern(details, haystack) {
                if ( details.matchAll ) { return true; }
                if ( details.re ) {
                    return this.RegExp_test.call(details.re, haystack) === details.expect;
                }
                return haystack.includes(details.pattern) === details.expect;
            },
            patternToRegex(pattern, flags = undefined, verbatim = false) {
                if ( pattern === '' ) { return /^/; }
                const match = /^\/(.+)\/([gimsu]*)$/.exec(pattern);
                if ( match === null ) {
                    const reStr = this.escapeRegexChars(pattern);
                    return new RegExp(verbatim ? `^${reStr}$` : reStr, flags);
                }
                try {
                    return new RegExp(match[1], match[2] || undefined);
                }
                catch(ex) {
                }
                return /^/;
            },
            getExtraArgs(args, offset = 0) {
                const entries = args.slice(offset).reduce((out, v, i, a) => {
                    if ( (i & 1) === 0 ) {
                        const rawValue = a[i+1];
                        const value = /^\d+$/.test(rawValue)
                            ? parseInt(rawValue, 10)
                            : rawValue;
                        out.push([ a[i], value ]);
                    }
                    return out;
                }, []);
                return this.Object_fromEntries(entries);
            },
            onIdle(fn, options) {
                if ( self.requestIdleCallback ) {
                    return self.requestIdleCallback(fn, options);
                }
                return self.requestAnimationFrame(fn);
            },
            offIdle(id) {
                if ( self.requestIdleCallback ) {
                    return self.cancelIdleCallback(id);
                }
                return self.cancelAnimationFrame(id);
            }
        };
        scriptletGlobals.safeSelf = safe;
        if ( scriptletGlobals.bcSecret === undefined ) { return safe; }
        // This is executed only when the logger is opened
        safe.logLevel = scriptletGlobals.logLevel || 1;
        let lastLogType = '';
        let lastLogText = '';
        let lastLogTime = 0;
        safe.toLogText = (type, ...args) => {
            if ( args.length === 0 ) { return; }
            const text = `[${document.location.hostname || document.location.href}]${args.join(' ')}`;
            if ( text === lastLogText && type === lastLogType ) {
                if ( (Date.now() - lastLogTime) < 5000 ) { return; }
            }
            lastLogType = type;
            lastLogText = text;
            lastLogTime = Date.now();
            return text;
        };
        try {
            const bc = new self.BroadcastChannel(scriptletGlobals.bcSecret);
            let bcBuffer = [];
            safe.sendToLogger = (type, ...args) => {
                const text = safe.toLogText(type, ...args);
                if ( text === undefined ) { return; }
                if ( bcBuffer === undefined ) {
                    return bc.postMessage({ what: 'messageToLogger', type, text });
                }
                bcBuffer.push({ type, text });
            };
            bc.onmessage = ev => {
                const msg = ev.data;
                switch ( msg ) {
                case 'iamready!':
                    if ( bcBuffer === undefined ) { break; }
                    bcBuffer.forEach(({ type, text }) =>
                        bc.postMessage({ what: 'messageToLogger', type, text })
                    );
                    bcBuffer = undefined;
                    break;
                case 'setScriptletLogLevelToOne':
                    safe.logLevel = 1;
                    break;
                case 'setScriptletLogLevelToTwo':
                    safe.logLevel = 2;
                    break;
                }
            };
            bc.postMessage('areyouready?');
        } catch(_) {
            safe.sendToLogger = (type, ...args) => {
                const text = safe.toLogText(type, ...args);
                if ( text === undefined ) { return; }
                safe.log(`uBO ${text}`);
            };
        }
        return safe;
    }
    
    try {
    // >>>> scriptlet start
    (function adjustSetTimeout(
        needleArg = '',
        delayArg = '',
        boostArg = ''
    ) {
        if ( typeof needleArg !== 'string' ) { return; }
        const safe = safeSelf();
        const reNeedle = safe.patternToRegex(needleArg);
        let delay = delayArg !== '*' ? parseInt(delayArg, 10) : -1;
        if ( isNaN(delay) || isFinite(delay) === false ) { delay = 1000; }
        let boost = parseFloat(boostArg);
        boost = isNaN(boost) === false && isFinite(boost)
            ? Math.min(Math.max(boost, 0.001), 50)
            : 0.05;
        self.setTimeout = new Proxy(self.setTimeout, {
            apply: function(target, thisArg, args) {
                const [ a, b ] = args;
                if (
                    (delay === -1 || b === delay) &&
                    reNeedle.test(a.toString())
                ) {
                    args[1] = b * boost;
                }
                return target.apply(thisArg, args);
            }
        });
    })("[native code]","17000","0.001");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    function jsonPruneFetchResponseFn(
        rawPrunePaths = '',
        rawNeedlePaths = ''
    ) {
        const safe = safeSelf();
        const logPrefix = safe.makeLogPrefix('json-prune-fetch-response', rawPrunePaths, rawNeedlePaths);
        const extraArgs = safe.getExtraArgs(Array.from(arguments), 2);
        const propNeedles = parsePropertiesToMatch(extraArgs.propsToMatch, 'url');
        const stackNeedle = safe.initPattern(extraArgs.stackToMatch || '', { canNegate: true });
        const logall = rawPrunePaths === '';
        const applyHandler = function(target, thisArg, args) {
            const fetchPromise = Reflect.apply(target, thisArg, args);
            let outcome = logall ? 'nomatch' : 'match';
            if ( propNeedles.size !== 0 ) {
                const objs = [ args[0] instanceof Object ? args[0] : { url: args[0] } ];
                if ( objs[0] instanceof Request ) {
                    try {
                        objs[0] = safe.Request_clone.call(objs[0]);
                    } catch(ex) {
                        safe.uboErr(logPrefix, 'Error:', ex);
                    }
                }
                if ( args[1] instanceof Object ) {
                    objs.push(args[1]);
                }
                if ( matchObjectProperties(propNeedles, ...objs) === false ) {
                    outcome = 'nomatch';
                }
            }
            if ( logall === false && outcome === 'nomatch' ) { return fetchPromise; }
            if ( safe.logLevel > 1 && outcome !== 'nomatch' && propNeedles.size !== 0 ) {
                safe.uboLog(logPrefix, `Matched optional "propsToMatch"\n${extraArgs.propsToMatch}`);
            }
            return fetchPromise.then(responseBefore => {
                const response = responseBefore.clone();
                return response.json().then(objBefore => {
                    if ( typeof objBefore !== 'object' ) { return responseBefore; }
                    if ( logall ) {
                        safe.uboLog(logPrefix, safe.JSON_stringify(objBefore, null, 2));
                        return responseBefore;
                    }
                    const objAfter = objectPruneFn(
                        objBefore,
                        rawPrunePaths,
                        rawNeedlePaths,
                        stackNeedle,
                        extraArgs
                    );
                    if ( typeof objAfter !== 'object' ) { return responseBefore; }
                    safe.uboLog(logPrefix, 'Pruned');
                    const responseAfter = Response.json(objAfter, {
                        status: responseBefore.status,
                        statusText: responseBefore.statusText,
                        headers: responseBefore.headers,
                    });
                    Object.defineProperties(responseAfter, {
                        ok: { value: responseBefore.ok },
                        redirected: { value: responseBefore.redirected },
                        type: { value: responseBefore.type },
                        url: { value: responseBefore.url },
                    });
                    return responseAfter;
                }).catch(reason => {
                    safe.uboErr(logPrefix, 'Error:', reason);
                    return responseBefore;
                });
            }).catch(reason => {
                safe.uboErr(logPrefix, 'Error:', reason);
                return fetchPromise;
            });
        };
        self.fetch = new Proxy(self.fetch, {
            apply: applyHandler
        });
    }
    
    function matchObjectProperties(propNeedles, ...objs) {
        if ( matchObjectProperties.extractProperties === undefined ) {
            matchObjectProperties.extractProperties = (src, des, props) => {
                for ( const p of props ) {
                    const v = src[p];
                    if ( v === undefined ) { continue; }
                    des[p] = src[p];
                }
            };
        }
        const safe = safeSelf();
        const haystack = {};
        const props = safe.Array_from(propNeedles.keys());
        for ( const obj of objs ) {
            if ( obj instanceof Object === false ) { continue; }
            matchObjectProperties.extractProperties(obj, haystack, props);
        }
        for ( const [ prop, details ] of propNeedles ) {
            let value = haystack[prop];
            if ( value === undefined ) { continue; }
            if ( typeof value !== 'string' ) {
                try { value = safe.JSON_stringify(value); }
                catch(ex) { }
                if ( typeof value !== 'string' ) { continue; }
            }
            if ( safe.testPattern(details, value) ) { continue; }
            return false;
        }
        return true;
    }
    
    function objectPruneFn(
        obj,
        rawPrunePaths,
        rawNeedlePaths,
        stackNeedleDetails = { matchAll: true },
        extraArgs = {}
    ) {
        if ( typeof rawPrunePaths !== 'string' ) { return; }
        const prunePaths = rawPrunePaths !== ''
            ? rawPrunePaths.split(/ +/)
            : [];
        const needlePaths = prunePaths.length !== 0 && rawNeedlePaths !== ''
            ? rawNeedlePaths.split(/ +/)
            : [];
        if ( stackNeedleDetails.matchAll !== true ) {
            if ( matchesStackTrace(stackNeedleDetails, extraArgs.logstack) === false ) {
                return;
            }
        }
        if ( objectPruneFn.mustProcess === undefined ) {
            objectPruneFn.mustProcess = (root, needlePaths) => {
                for ( const needlePath of needlePaths ) {
                    if ( objectFindOwnerFn(root, needlePath) === false ) {
                        return false;
                    }
                }
                return true;
            };
        }
        if ( prunePaths.length === 0 ) { return; }
        let outcome = 'nomatch';
        if ( objectPruneFn.mustProcess(obj, needlePaths) ) {
            for ( const path of prunePaths ) {
                if ( objectFindOwnerFn(obj, path, true) ) {
                    outcome = 'match';
                }
            }
        }
        if ( outcome === 'match' ) { return obj; }
    }
    
    function parsePropertiesToMatch(propsToMatch, implicit = '') {
        const safe = safeSelf();
        const needles = new Map();
        if ( propsToMatch === undefined || propsToMatch === '' ) { return needles; }
        const options = { canNegate: true };
        for ( const needle of propsToMatch.split(/\s+/) ) {
            const [ prop, pattern ] = needle.split(':');
            if ( prop === '' ) { continue; }
            if ( pattern !== undefined ) {
                needles.set(prop, safe.initPattern(pattern, options));
            } else if ( implicit !== '' ) {
                needles.set(implicit, safe.initPattern(prop, options));
            }
        }
        return needles;
    }
    
    function matchesStackTrace(
        needleDetails,
        logLevel = ''
    ) {
        const safe = safeSelf();
        const exceptionToken = getExceptionToken();
        const error = new safe.Error(exceptionToken);
        const docURL = new URL(self.location.href);
        docURL.hash = '';
        // Normalize stack trace
        const reLine = /(.*?@)?(\S+)(:\d+):\d+\)?$/;
        const lines = [];
        for ( let line of error.stack.split(/[\n\r]+/) ) {
            if ( line.includes(exceptionToken) ) { continue; }
            line = line.trim();
            const match = safe.RegExp_exec.call(reLine, line);
            if ( match === null ) { continue; }
            let url = match[2];
            if ( url.startsWith('(') ) { url = url.slice(1); }
            if ( url === docURL.href ) {
                url = 'inlineScript';
            } else if ( url.startsWith('<anonymous>') ) {
                url = 'injectedScript';
            }
            let fn = match[1] !== undefined
                ? match[1].slice(0, -1)
                : line.slice(0, match.index).trim();
            if ( fn.startsWith('at') ) { fn = fn.slice(2).trim(); }
            let rowcol = match[3];
            lines.push(' ' + `${fn} ${url}${rowcol}:1`.trim());
        }
        lines[0] = `stackDepth:${lines.length-1}`;
        const stack = lines.join('\t');
        const r = needleDetails.matchAll !== true &&
            safe.testPattern(needleDetails, stack);
        if (
            logLevel === 'all' ||
            logLevel === 'match' && r ||
            logLevel === 'nomatch' && !r
        ) {
            safe.uboLog(stack.replace(/\t/g, '\n'));
        }
        return r;
    }
    
    function objectFindOwnerFn(
        root,
        path,
        prune = false
    ) {
        let owner = root;
        let chain = path;
        for (;;) {
            if ( typeof owner !== 'object' || owner === null  ) { return false; }
            const pos = chain.indexOf('.');
            if ( pos === -1 ) {
                if ( prune === false ) {
                    return owner.hasOwnProperty(chain);
                }
                let modified = false;
                if ( chain === '*' ) {
                    for ( const key in owner ) {
                        if ( owner.hasOwnProperty(key) === false ) { continue; }
                        delete owner[key];
                        modified = true;
                    }
                } else if ( owner.hasOwnProperty(chain) ) {
                    delete owner[chain];
                    modified = true;
                }
                return modified;
            }
            const prop = chain.slice(0, pos);
            const next = chain.slice(pos + 1);
            let found = false;
            if ( prop === '[-]' && Array.isArray(owner) ) {
                let i = owner.length;
                while ( i-- ) {
                    if ( objectFindOwnerFn(owner[i], next) === false ) { continue; }
                    owner.splice(i, 1);
                    found = true;
                }
                return found;
            }
            if ( prop === '{-}' && owner instanceof Object ) {
                for ( const key of Object.keys(owner) ) {
                    if ( objectFindOwnerFn(owner[key], next) === false ) { continue; }
                    delete owner[key];
                    found = true;
                }
                return found;
            }
            if (
                prop === '[]' && Array.isArray(owner) ||
                prop === '{}' && owner instanceof Object ||
                prop === '*' && owner instanceof Object
            ) {
                for ( const key of Object.keys(owner) ) {
                    if (objectFindOwnerFn(owner[key], next, prune) === false ) { continue; }
                    found = true;
                }
                return found;
            }
            if ( owner.hasOwnProperty(prop) === false ) { return false; }
            owner = owner[prop];
            chain = chain.slice(pos + 1);
        }
    }
    
    function getExceptionToken() {
        const token = getRandomToken();
        const oe = self.onerror;
        self.onerror = function(msg, ...args) {
            if ( typeof msg === 'string' && msg.includes(token) ) { return true; }
            if ( oe instanceof Function ) {
                return oe.call(this, msg, ...args);
            }
        }.bind();
        return token;
    }
    
    function getRandomToken() {
        const safe = safeSelf();
        return safe.String_fromCharCode(Date.now() % 26 + 97) +
            safe.Math_floor(safe.Math_random() * 982451653 + 982451653).toString(36);
    }
    
    try {
    // >>>> scriptlet start
    (function jsonPruneFetchResponse(...args) {
        jsonPruneFetchResponseFn(...args);
    })("playerAds adPlacements adSlots playerResponse.playerAds playerResponse.adPlacements playerResponse.adSlots [].playerResponse.adPlacements [].playerResponse.playerAds [].playerResponse.adSlots","","propsToMatch","/\\/(player|get_watch)\\?/");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    try {
    // >>>> scriptlet start
    (function jsonPruneFetchResponse(...args) {
        jsonPruneFetchResponseFn(...args);
    })("playerAds adPlacements adSlots playerResponse.playerAds playerResponse.adPlacements playerResponse.adSlots","","propsToMatch","/playlist?");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    try {
    // >>>> scriptlet start
    (function jsonPruneXhrResponse(
        rawPrunePaths = '',
        rawNeedlePaths = ''
    ) {
        const safe = safeSelf();
        const logPrefix = safe.makeLogPrefix('json-prune-xhr-response', rawPrunePaths, rawNeedlePaths);
        const xhrInstances = new WeakMap();
        const extraArgs = safe.getExtraArgs(Array.from(arguments), 2);
        const propNeedles = parsePropertiesToMatch(extraArgs.propsToMatch, 'url');
        const stackNeedle = safe.initPattern(extraArgs.stackToMatch || '', { canNegate: true });
        self.XMLHttpRequest = class extends self.XMLHttpRequest {
            open(method, url, ...args) {
                const xhrDetails = { method, url };
                let outcome = 'match';
                if ( propNeedles.size !== 0 ) {
                    if ( matchObjectProperties(propNeedles, xhrDetails) === false ) {
                        outcome = 'nomatch';
                    }
                }
                if ( outcome === 'match' ) {
                    if ( safe.logLevel > 1 ) {
                        safe.uboLog(logPrefix, `Matched optional "propsToMatch", "${extraArgs.propsToMatch}"`);
                    }
                    xhrInstances.set(this, xhrDetails);
                }
                return super.open(method, url, ...args);
            }
            get response() {
                const innerResponse = super.response;
                const xhrDetails = xhrInstances.get(this);
                if ( xhrDetails === undefined ) {
                    return innerResponse;
                }
                const responseLength = typeof innerResponse === 'string'
                    ? innerResponse.length
                    : undefined;
                if ( xhrDetails.lastResponseLength !== responseLength ) {
                    xhrDetails.response = undefined;
                    xhrDetails.lastResponseLength = responseLength;
                }
                if ( xhrDetails.response !== undefined ) {
                    return xhrDetails.response;
                }
                let objBefore;
                if ( typeof innerResponse === 'object' ) {
                    objBefore = innerResponse;
                } else if ( typeof innerResponse === 'string' ) {
                    try {
                        objBefore = safe.JSON_parse(innerResponse);
                    } catch(ex) {
                    }
                }
                if ( typeof objBefore !== 'object' ) {
                    return (xhrDetails.response = innerResponse);
                }
                const objAfter = objectPruneFn(
                    objBefore,
                    rawPrunePaths,
                    rawNeedlePaths,
                    stackNeedle,
                    extraArgs
                );
                let outerResponse;
                if ( typeof objAfter === 'object' ) {
                    outerResponse = typeof innerResponse === 'string'
                        ? safe.JSON_stringify(objAfter)
                        : objAfter;
                    safe.uboLog(logPrefix, 'Pruned');
                } else {
                    outerResponse = innerResponse;
                }
                return (xhrDetails.response = outerResponse);
            }
            get responseText() {
                const response = this.response;
                return typeof response !== 'string'
                    ? super.responseText
                    : response;
            }
        };
    })("playerAds adPlacements adSlots playerResponse.playerAds playerResponse.adPlacements playerResponse.adSlots [].playerResponse.adPlacements [].playerResponse.playerAds [].playerResponse.adSlots","","propsToMatch","/\\/player(?:\\?.+)?$/");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    function setConstantFn(
        trusted = false,
        chain = '',
        rawValue = ''
    ) {
        if ( chain === '' ) { return; }
        const safe = safeSelf();
        const logPrefix = safe.makeLogPrefix('set-constant', chain, rawValue);
        const extraArgs = safe.getExtraArgs(Array.from(arguments), 3);
        function setConstant(chain, rawValue) {
            const trappedProp = (( ) => {
                const pos = chain.lastIndexOf('.');
                if ( pos === -1 ) { return chain; }
                return chain.slice(pos+1);
            })();
            const cloakFunc = fn => {
                safe.Object_defineProperty(fn, 'name', { value: trappedProp });
                return new Proxy(fn, {
                    defineProperty(target, prop) {
                        if ( prop !== 'toString' ) {
                            return Reflect.defineProperty(...arguments);
                        }
                        return true;
                    },
                    deleteProperty(target, prop) {
                        if ( prop !== 'toString' ) {
                            return Reflect.deleteProperty(...arguments);
                        }
                        return true;
                    },
                    get(target, prop) {
                        if ( prop === 'toString' ) {
                            return function() {
                                return `function ${trappedProp}() { [native code] }`;
                            }.bind(null);
                        }
                        return Reflect.get(...arguments);
                    },
                });
            };
            if ( trappedProp === '' ) { return; }
            const thisScript = document.currentScript;
            let normalValue = validateConstantFn(trusted, rawValue, extraArgs);
            if ( rawValue === 'noopFunc' || rawValue === 'trueFunc' || rawValue === 'falseFunc' ) {
                normalValue = cloakFunc(normalValue);
            }
            let aborted = false;
            const mustAbort = function(v) {
                if ( trusted ) { return false; }
                if ( aborted ) { return true; }
                aborted =
                    (v !== undefined && v !== null) &&
                    (normalValue !== undefined && normalValue !== null) &&
                    (typeof v !== typeof normalValue);
                if ( aborted ) {
                    safe.uboLog(logPrefix, `Aborted because value set to ${v}`);
                }
                return aborted;
            };
            // https://github.com/uBlockOrigin/uBlock-issues/issues/156
            //   Support multiple trappers for the same property.
            const trapProp = function(owner, prop, configurable, handler) {
                if ( handler.init(configurable ? owner[prop] : normalValue) === false ) { return; }
                const odesc = safe.Object_getOwnPropertyDescriptor(owner, prop);
                let prevGetter, prevSetter;
                if ( odesc instanceof safe.Object ) {
                    owner[prop] = normalValue;
                    if ( odesc.get instanceof Function ) {
                        prevGetter = odesc.get;
                    }
                    if ( odesc.set instanceof Function ) {
                        prevSetter = odesc.set;
                    }
                }
                try {
                    safe.Object_defineProperty(owner, prop, {
                        configurable,
                        get() {
                            if ( prevGetter !== undefined ) {
                                prevGetter();
                            }
                            return handler.getter();
                        },
                        set(a) {
                            if ( prevSetter !== undefined ) {
                                prevSetter(a);
                            }
                            handler.setter(a);
                        }
                    });
                    safe.uboLog(logPrefix, 'Trap installed');
                } catch(ex) {
                    safe.uboErr(logPrefix, ex);
                }
            };
            const trapChain = function(owner, chain) {
                const pos = chain.indexOf('.');
                if ( pos === -1 ) {
                    trapProp(owner, chain, false, {
                        v: undefined,
                        init: function(v) {
                            if ( mustAbort(v) ) { return false; }
                            this.v = v;
                            return true;
                        },
                        getter: function() {
                            if ( document.currentScript === thisScript ) {
                                return this.v;
                            }
                            safe.uboLog(logPrefix, 'Property read');
                            return normalValue;
                        },
                        setter: function(a) {
                            if ( mustAbort(a) === false ) { return; }
                            normalValue = a;
                        }
                    });
                    return;
                }
                const prop = chain.slice(0, pos);
                const v = owner[prop];
                chain = chain.slice(pos + 1);
                if ( v instanceof safe.Object || typeof v === 'object' && v !== null ) {
                    trapChain(v, chain);
                    return;
                }
                trapProp(owner, prop, true, {
                    v: undefined,
                    init: function(v) {
                        this.v = v;
                        return true;
                    },
                    getter: function() {
                        return this.v;
                    },
                    setter: function(a) {
                        this.v = a;
                        if ( a instanceof safe.Object ) {
                            trapChain(a, chain);
                        }
                    }
                });
            };
            trapChain(window, chain);
        }
        runAt(( ) => {
            setConstant(chain, rawValue);
        }, extraArgs.runAt);
    }
    
    function runAt(fn, when) {
        const intFromReadyState = state => {
            const targets = {
                'loading': 1, 'asap': 1,
                'interactive': 2, 'end': 2, '2': 2,
                'complete': 3, 'idle': 3, '3': 3,
            };
            const tokens = Array.isArray(state) ? state : [ state ];
            for ( const token of tokens ) {
                const prop = `${token}`;
                if ( targets.hasOwnProperty(prop) === false ) { continue; }
                return targets[prop];
            }
            return 0;
        };
        const runAt = intFromReadyState(when);
        if ( intFromReadyState(document.readyState) >= runAt ) {
            fn(); return;
        }
        const onStateChange = ( ) => {
            if ( intFromReadyState(document.readyState) < runAt ) { return; }
            fn();
            safe.removeEventListener.apply(document, args);
        };
        const safe = safeSelf();
        const args = [ 'readystatechange', onStateChange, { capture: true } ];
        safe.addEventListener.apply(document, args);
    }
    
    function validateConstantFn(trusted, raw, extraArgs = {}) {
        const safe = safeSelf();
        let value;
        if ( raw === 'undefined' ) {
            value = undefined;
        } else if ( raw === 'false' ) {
            value = false;
        } else if ( raw === 'true' ) {
            value = true;
        } else if ( raw === 'null' ) {
            value = null;
        } else if ( raw === "''" || raw === '' ) {
            value = '';
        } else if ( raw === '[]' || raw === 'emptyArr' ) {
            value = [];
        } else if ( raw === '{}' || raw === 'emptyObj' ) {
            value = {};
        } else if ( raw === 'noopFunc' ) {
            value = function(){};
        } else if ( raw === 'trueFunc' ) {
            value = function(){ return true; };
        } else if ( raw === 'falseFunc' ) {
            value = function(){ return false; };
        } else if ( raw === 'throwFunc' ) {
            value = function(){ throw ''; };
        } else if ( /^-?\d+$/.test(raw) ) {
            value = parseInt(raw);
            if ( isNaN(raw) ) { return; }
            if ( Math.abs(raw) > 0x7FFF ) { return; }
        } else if ( trusted ) {
            if ( raw.startsWith('json:') ) {
                try { value = safe.JSON_parse(raw.slice(5)); } catch(ex) { return; }
            } else if ( raw.startsWith('{') && raw.endsWith('}') ) {
                try { value = safe.JSON_parse(raw).value; } catch(ex) { return; }
            }
        } else {
            return;
        }
        if ( extraArgs.as !== undefined ) {
            if ( extraArgs.as === 'function' ) {
                return ( ) => value;
            } else if ( extraArgs.as === 'callback' ) {
                return ( ) => (( ) => value);
            } else if ( extraArgs.as === 'resolved' ) {
                return Promise.resolve(value);
            } else if ( extraArgs.as === 'rejected' ) {
                return Promise.reject(value);
            }
        }
        return value;
    }
    
    try {
    // >>>> scriptlet start
    (function setConstant(
        ...args
    ) {
        setConstantFn(false, ...args);
    })("google_ad_status","1");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    try {
    // >>>> scriptlet start
    (function setConstant(
        ...args
    ) {
        setConstantFn(false, ...args);
    })("ytInitialPlayerResponse.adPlacements","undefined");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    try {
    // >>>> scriptlet start
    (function setConstant(
        ...args
    ) {
        setConstantFn(false, ...args);
    })("ytInitialPlayerResponse.adSlots","undefined");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    try {
    // >>>> scriptlet start
    (function setConstant(
        ...args
    ) {
        setConstantFn(false, ...args);
    })("ytInitialPlayerResponse.playerAds","undefined");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    try {
    // >>>> scriptlet start
    (function setConstant(
        ...args
    ) {
        setConstantFn(false, ...args);
    })("playerResponse.adPlacements","undefined");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    try {
    // >>>> scriptlet start
    (function jsonPruneXhrResponse(
        rawPrunePaths = '',
        rawNeedlePaths = ''
    ) {
        const safe = safeSelf();
        const logPrefix = safe.makeLogPrefix('json-prune-xhr-response', rawPrunePaths, rawNeedlePaths);
        const xhrInstances = new WeakMap();
        const extraArgs = safe.getExtraArgs(Array.from(arguments), 2);
        const propNeedles = parsePropertiesToMatch(extraArgs.propsToMatch, 'url');
        const stackNeedle = safe.initPattern(extraArgs.stackToMatch || '', { canNegate: true });
        self.XMLHttpRequest = class extends self.XMLHttpRequest {
            open(method, url, ...args) {
                const xhrDetails = { method, url };
                let outcome = 'match';
                if ( propNeedles.size !== 0 ) {
                    if ( matchObjectProperties(propNeedles, xhrDetails) === false ) {
                        outcome = 'nomatch';
                    }
                }
                if ( outcome === 'match' ) {
                    if ( safe.logLevel > 1 ) {
                        safe.uboLog(logPrefix, `Matched optional "propsToMatch", "${extraArgs.propsToMatch}"`);
                    }
                    xhrInstances.set(this, xhrDetails);
                }
                return super.open(method, url, ...args);
            }
            get response() {
                const innerResponse = super.response;
                const xhrDetails = xhrInstances.get(this);
                if ( xhrDetails === undefined ) {
                    return innerResponse;
                }
                const responseLength = typeof innerResponse === 'string'
                    ? innerResponse.length
                    : undefined;
                if ( xhrDetails.lastResponseLength !== responseLength ) {
                    xhrDetails.response = undefined;
                    xhrDetails.lastResponseLength = responseLength;
                }
                if ( xhrDetails.response !== undefined ) {
                    return xhrDetails.response;
                }
                let objBefore;
                if ( typeof innerResponse === 'object' ) {
                    objBefore = innerResponse;
                } else if ( typeof innerResponse === 'string' ) {
                    try {
                        objBefore = safe.JSON_parse(innerResponse);
                    } catch(ex) {
                    }
                }
                if ( typeof objBefore !== 'object' ) {
                    return (xhrDetails.response = innerResponse);
                }
                const objAfter = objectPruneFn(
                    objBefore,
                    rawPrunePaths,
                    rawNeedlePaths,
                    stackNeedle,
                    extraArgs
                );
                let outerResponse;
                if ( typeof objAfter === 'object' ) {
                    outerResponse = typeof innerResponse === 'string'
                        ? safe.JSON_stringify(objAfter)
                        : objAfter;
                    safe.uboLog(logPrefix, 'Pruned');
                } else {
                    outerResponse = innerResponse;
                }
                return (xhrDetails.response = outerResponse);
            }
            get responseText() {
                const response = this.response;
                return typeof response !== 'string'
                    ? super.responseText
                    : response;
            }
        };
    })("playerResponse.adPlacements playerResponse.playerAds playerResponse.adSlots adPlacements playerAds adSlots","","/playlist\\?list=|\\/player(?!.*(get_drm_license))|watch\\?[tv]=|get_watch\\?/");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    try {
    // >>>> scriptlet start
    (function jsonPruneFetchResponse(...args) {
        jsonPruneFetchResponseFn(...args);
    })("playerResponse.adPlacements playerResponse.playerAds playerResponse.adSlots adPlacements playerAds adSlots","","/playlist\\?list=|player\\?|watch\\?[tv]=|get_watch\\?/");
    // <<<< scriptlet end
    } catch (e) {
    
    }
    
    // <<<< end of private namespace
    })();