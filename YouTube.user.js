// ==UserScript==
// @name        YouTube
// @description uBLock Origin YouTube Scriptlet
// @match       *://*.youtube.com/*
// ==/UserScript==

(function(details) {
    if (typeof self.uBO_scriptletsInjected === 'string') {
        return;
    }
    const doc = document;
    const {
        location
    } = doc;
    if (location === null) {
        return;
    }
    const {
        hostname
    } = location;
    if (hostname !== '' && details.hostname !== hostname) {
        return;
    }
    // Use a page world sentinel to verify that execution was
    // successful
    const {
        sentinel
    } = details;
    let script;
    try {
        const code = [
            `self['${sentinel}'] = true;`,
            details.scriptlets,
        ].join('\n');
        script = doc.createElement('script');
        script.appendChild(doc.createTextNode(code));
        (doc.head || doc.documentElement).appendChild(script);
    } catch (ex) {}
    if (script) {
        script.remove();
        script.textContent = '';
        script = undefined;
    }
    if (self.wrappedJSObject[sentinel]) {
        delete self.wrappedJSObject[sentinel];
        self.uBO_scriptletsInjected = details.filters;
        return 0;
    }
    // https://github.com/uBlockOrigin/uBlock-issues/issues/235
    //   Fall back to blob injection if execution through direct
    //   injection failed
    let url;
    try {
        const blob = new self.Blob(
            [details.scriptlets], {
                type: 'text/javascript; charset=utf-8'
            }
        );
        url = self.URL.createObjectURL(blob);
        script = doc.createElement('script');
        script.async = false;
        script.src = url;
        (doc.head || doc.documentElement || doc).append(script);
        self.uBO_scriptletsInjected = details.filters;
    } catch (ex) {}
    if (url) {
        if (script) {
            script.remove();
        }
        self.URL.revokeObjectURL(url);
    }
    return 0;
})({
    "hostname": "www.youtube.com",
    "scriptlets": "(function() {\n// >>>> start of private namespace\n\n;\n\nconst scriptletGlobals = {\n    \"warOrigin\": \"moz-extension://ad4b652f-1460-4f28-873d-bcee18d1e9e0/web_accessible_resources\",\n    \"warSecret\": \"8sv4s1sysolpjcompj\"\n}\n\nfunction jsonPruneFetchResponseFn(\n    rawPrunePaths = '',\n    rawNeedlePaths = ''\n) {\n    const safe = safeSelf();\n    const logPrefix = safe.makeLogPrefix('json-prune-fetch-response', rawPrunePaths, rawNeedlePaths);\n    const extraArgs = safe.getExtraArgs(Array.from(arguments), 2);\n    const propNeedles = parsePropertiesToMatch(extraArgs.propsToMatch, 'url');\n    const stackNeedle = safe.initPattern(extraArgs.stackToMatch || '', { canNegate: true });\n    const logall = rawPrunePaths === '';\n    const applyHandler = function(target, thisArg, args) {\n        const fetchPromise = Reflect.apply(target, thisArg, args);\n        let outcome = logall ? 'nomatch' : 'match';\n        if ( propNeedles.size !== 0 ) {\n            const objs = [ args[0] instanceof Object ? args[0] : { url: args[0] } ];\n            if ( objs[0] instanceof Request ) {\n                try {\n                    objs[0] = safe.Request_clone.call(objs[0]);\n                } catch(ex) {\n                    safe.uboErr(logPrefix, 'Error:', ex);\n                }\n            }\n            if ( args[1] instanceof Object ) {\n                objs.push(args[1]);\n            }\n            if ( matchObjectProperties(propNeedles, ...objs) === false ) {\n                outcome = 'nomatch';\n            }\n        }\n        if ( logall === false && outcome === 'nomatch' ) { return fetchPromise; }\n        if ( safe.logLevel > 1 && outcome !== 'nomatch' && propNeedles.size !== 0 ) {\n            safe.uboLog(logPrefix, `Matched optional \"propsToMatch\"\\n${extraArgs.propsToMatch}`);\n        }\n        return fetchPromise.then(responseBefore => {\n            const response = responseBefore.clone();\n            return response.json().then(objBefore => {\n                if ( typeof objBefore !== 'object' ) { return responseBefore; }\n                if ( logall ) {\n                    safe.uboLog(logPrefix, safe.JSON_stringify(objBefore, null, 2));\n                    return responseBefore;\n                }\n                const objAfter = objectPruneFn(\n                    objBefore,\n                    rawPrunePaths,\n                    rawNeedlePaths,\n                    stackNeedle,\n                    extraArgs\n                );\n                if ( typeof objAfter !== 'object' ) { return responseBefore; }\n                safe.uboLog(logPrefix, 'Pruned');\n                const responseAfter = Response.json(objAfter, {\n                    status: responseBefore.status,\n                    statusText: responseBefore.statusText,\n                    headers: responseBefore.headers,\n                });\n                Object.defineProperties(responseAfter, {\n                    ok: { value: responseBefore.ok },\n                    redirected: { value: responseBefore.redirected },\n                    type: { value: responseBefore.type },\n                    url: { value: responseBefore.url },\n                });\n                return responseAfter;\n            }).catch(reason => {\n                safe.uboErr(logPrefix, 'Error:', reason);\n                return responseBefore;\n            });\n        }).catch(reason => {\n            safe.uboErr(logPrefix, 'Error:', reason);\n            return fetchPromise;\n        });\n    };\n    self.fetch = new Proxy(self.fetch, {\n        apply: applyHandler\n    });\n}\n\nfunction matchObjectProperties(propNeedles, ...objs) {\n    if ( matchObjectProperties.extractProperties === undefined ) {\n        matchObjectProperties.extractProperties = (src, des, props) => {\n            for ( const p of props ) {\n                const v = src[p];\n                if ( v === undefined ) { continue; }\n                des[p] = src[p];\n            }\n        };\n    }\n    const safe = safeSelf();\n    const haystack = {};\n    const props = safe.Array_from(propNeedles.keys());\n    for ( const obj of objs ) {\n        if ( obj instanceof Object === false ) { continue; }\n        matchObjectProperties.extractProperties(obj, haystack, props);\n    }\n    for ( const [ prop, details ] of propNeedles ) {\n        let value = haystack[prop];\n        if ( value === undefined ) { continue; }\n        if ( typeof value !== 'string' ) {\n            try { value = safe.JSON_stringify(value); }\n            catch(ex) { }\n            if ( typeof value !== 'string' ) { continue; }\n        }\n        if ( safe.testPattern(details, value) ) { continue; }\n        return false;\n    }\n    return true;\n}\n\nfunction objectPruneFn(\n    obj,\n    rawPrunePaths,\n    rawNeedlePaths,\n    stackNeedleDetails = { matchAll: true },\n    extraArgs = {}\n) {\n    if ( typeof rawPrunePaths !== 'string' ) { return; }\n    const safe = safeSelf();\n    const prunePaths = rawPrunePaths !== ''\n        ? safe.String_split.call(rawPrunePaths, / +/)\n        : [];\n    const needlePaths = prunePaths.length !== 0 && rawNeedlePaths !== ''\n        ? safe.String_split.call(rawNeedlePaths, / +/)\n        : [];\n    if ( stackNeedleDetails.matchAll !== true ) {\n        if ( matchesStackTraceFn(stackNeedleDetails, extraArgs.logstack) === false ) {\n            return;\n        }\n    }\n    if ( objectPruneFn.mustProcess === undefined ) {\n        objectPruneFn.mustProcess = (root, needlePaths) => {\n            for ( const needlePath of needlePaths ) {\n                if ( objectFindOwnerFn(root, needlePath) === false ) {\n                    return false;\n                }\n            }\n            return true;\n        };\n    }\n    if ( prunePaths.length === 0 ) { return; }\n    let outcome = 'nomatch';\n    if ( objectPruneFn.mustProcess(obj, needlePaths) ) {\n        for ( const path of prunePaths ) {\n            if ( objectFindOwnerFn(obj, path, true) ) {\n                outcome = 'match';\n            }\n        }\n    }\n    if ( outcome === 'match' ) { return obj; }\n}\n\nfunction parsePropertiesToMatch(propsToMatch, implicit = '') {\n    const safe = safeSelf();\n    const needles = new Map();\n    if ( propsToMatch === undefined || propsToMatch === '' ) { return needles; }\n    const options = { canNegate: true };\n    for ( const needle of safe.String_split.call(propsToMatch, /\\s+/) ) {\n        let [ prop, pattern ] = safe.String_split.call(needle, ':');\n        if ( prop === '' ) { continue; }\n        if ( pattern !== undefined && /[^$\\w -]/.test(prop) ) {\n            prop = `${prop}:${pattern}`;\n            pattern = undefined;\n        }\n        if ( pattern !== undefined ) {\n            needles.set(prop, safe.initPattern(pattern, options));\n        } else if ( implicit !== '' ) {\n            needles.set(implicit, safe.initPattern(prop, options));\n        }\n    }\n    return needles;\n}\n\nfunction safeSelf() {\n    if ( scriptletGlobals.safeSelf ) {\n        return scriptletGlobals.safeSelf;\n    }\n    const self = globalThis;\n    const safe = {\n        'Array_from': Array.from,\n        'Error': self.Error,\n        'Function_toStringFn': self.Function.prototype.toString,\n        'Function_toString': thisArg => safe.Function_toStringFn.call(thisArg),\n        'Math_floor': Math.floor,\n        'Math_max': Math.max,\n        'Math_min': Math.min,\n        'Math_random': Math.random,\n        'Object': Object,\n        'Object_defineProperty': Object.defineProperty.bind(Object),\n        'Object_defineProperties': Object.defineProperties.bind(Object),\n        'Object_fromEntries': Object.fromEntries.bind(Object),\n        'Object_getOwnPropertyDescriptor': Object.getOwnPropertyDescriptor.bind(Object),\n        'RegExp': self.RegExp,\n        'RegExp_test': self.RegExp.prototype.test,\n        'RegExp_exec': self.RegExp.prototype.exec,\n        'Request_clone': self.Request.prototype.clone,\n        'String_fromCharCode': String.fromCharCode,\n        'String_split': String.prototype.split,\n        'XMLHttpRequest': self.XMLHttpRequest,\n        'addEventListener': self.EventTarget.prototype.addEventListener,\n        'removeEventListener': self.EventTarget.prototype.removeEventListener,\n        'fetch': self.fetch,\n        'JSON': self.JSON,\n        'JSON_parseFn': self.JSON.parse,\n        'JSON_stringifyFn': self.JSON.stringify,\n        'JSON_parse': (...args) => safe.JSON_parseFn.call(safe.JSON, ...args),\n        'JSON_stringify': (...args) => safe.JSON_stringifyFn.call(safe.JSON, ...args),\n        'log': console.log.bind(console),\n        // Properties\n        logLevel: 0,\n        // Methods\n        makeLogPrefix(...args) {\n            return this.sendToLogger && `[${args.join(' \\u205D ')}]` || '';\n        },\n        uboLog(...args) {\n            if ( this.sendToLogger === undefined ) { return; }\n            if ( args === undefined || args[0] === '' ) { return; }\n            return this.sendToLogger('info', ...args);\n            \n        },\n        uboErr(...args) {\n            if ( this.sendToLogger === undefined ) { return; }\n            if ( args === undefined || args[0] === '' ) { return; }\n            return this.sendToLogger('error', ...args);\n        },\n        escapeRegexChars(s) {\n            return s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');\n        },\n        initPattern(pattern, options = {}) {\n            if ( pattern === '' ) {\n                return { matchAll: true, expect: true };\n            }\n            const expect = (options.canNegate !== true || pattern.startsWith('!') === false);\n            if ( expect === false ) {\n                pattern = pattern.slice(1);\n            }\n            const match = /^\\/(.+)\\/([gimsu]*)$/.exec(pattern);\n            if ( match !== null ) {\n                return {\n                    re: new this.RegExp(\n                        match[1],\n                        match[2] || options.flags\n                    ),\n                    expect,\n                };\n            }\n            if ( options.flags !== undefined ) {\n                return {\n                    re: new this.RegExp(this.escapeRegexChars(pattern),\n                        options.flags\n                    ),\n                    expect,\n                };\n            }\n            return { pattern, expect };\n        },\n        testPattern(details, haystack) {\n            if ( details.matchAll ) { return true; }\n            if ( details.re ) {\n                return this.RegExp_test.call(details.re, haystack) === details.expect;\n            }\n            return haystack.includes(details.pattern) === details.expect;\n        },\n        patternToRegex(pattern, flags = undefined, verbatim = false) {\n            if ( pattern === '' ) { return /^/; }\n            const match = /^\\/(.+)\\/([gimsu]*)$/.exec(pattern);\n            if ( match === null ) {\n                const reStr = this.escapeRegexChars(pattern);\n                return new RegExp(verbatim ? `^${reStr}$` : reStr, flags);\n            }\n            try {\n                return new RegExp(match[1], match[2] || undefined);\n            }\n            catch(ex) {\n            }\n            return /^/;\n        },\n        getExtraArgs(args, offset = 0) {\n            const entries = args.slice(offset).reduce((out, v, i, a) => {\n                if ( (i & 1) === 0 ) {\n                    const rawValue = a[i+1];\n                    const value = /^\\d+$/.test(rawValue)\n                        ? parseInt(rawValue, 10)\n                        : rawValue;\n                    out.push([ a[i], value ]);\n                }\n                return out;\n            }, []);\n            return this.Object_fromEntries(entries);\n        },\n        onIdle(fn, options) {\n            if ( self.requestIdleCallback ) {\n                return self.requestIdleCallback(fn, options);\n            }\n            return self.requestAnimationFrame(fn);\n        },\n        offIdle(id) {\n            if ( self.requestIdleCallback ) {\n                return self.cancelIdleCallback(id);\n            }\n            return self.cancelAnimationFrame(id);\n        }\n    };\n    scriptletGlobals.safeSelf = safe;\n    if ( scriptletGlobals.bcSecret === undefined ) { return safe; }\n    // This is executed only when the logger is opened\n    safe.logLevel = scriptletGlobals.logLevel || 1;\n    let lastLogType = '';\n    let lastLogText = '';\n    let lastLogTime = 0;\n    safe.toLogText = (type, ...args) => {\n        if ( args.length === 0 ) { return; }\n        const text = `[${document.location.hostname || document.location.href}]${args.join(' ')}`;\n        if ( text === lastLogText && type === lastLogType ) {\n            if ( (Date.now() - lastLogTime) < 5000 ) { return; }\n        }\n        lastLogType = type;\n        lastLogText = text;\n        lastLogTime = Date.now();\n        return text;\n    };\n    try {\n        const bc = new self.BroadcastChannel(scriptletGlobals.bcSecret);\n        let bcBuffer = [];\n        safe.sendToLogger = (type, ...args) => {\n            const text = safe.toLogText(type, ...args);\n            if ( text === undefined ) { return; }\n            if ( bcBuffer === undefined ) {\n                return bc.postMessage({ what: 'messageToLogger', type, text });\n            }\n            bcBuffer.push({ type, text });\n        };\n        bc.onmessage = ev => {\n            const msg = ev.data;\n            switch ( msg ) {\n            case 'iamready!':\n                if ( bcBuffer === undefined ) { break; }\n                bcBuffer.forEach(({ type, text }) =>\n                    bc.postMessage({ what: 'messageToLogger', type, text })\n                );\n                bcBuffer = undefined;\n                break;\n            case 'setScriptletLogLevelToOne':\n                safe.logLevel = 1;\n                break;\n            case 'setScriptletLogLevelToTwo':\n                safe.logLevel = 2;\n                break;\n            }\n        };\n        bc.postMessage('areyouready?');\n    } catch(_) {\n        safe.sendToLogger = (type, ...args) => {\n            const text = safe.toLogText(type, ...args);\n            if ( text === undefined ) { return; }\n            safe.log(`uBO ${text}`);\n        };\n    }\n    return safe;\n}\n\nfunction matchesStackTraceFn(\n    needleDetails,\n    logLevel = ''\n) {\n    const safe = safeSelf();\n    const exceptionToken = getExceptionToken();\n    const error = new safe.Error(exceptionToken);\n    const docURL = new URL(self.location.href);\n    docURL.hash = '';\n    // Normalize stack trace\n    const reLine = /(.*?@)?(\\S+)(:\\d+):\\d+\\)?$/;\n    const lines = [];\n    for ( let line of safe.String_split.call(error.stack, /[\\n\\r]+/) ) {\n        if ( line.includes(exceptionToken) ) { continue; }\n        line = line.trim();\n        const match = safe.RegExp_exec.call(reLine, line);\n        if ( match === null ) { continue; }\n        let url = match[2];\n        if ( url.startsWith('(') ) { url = url.slice(1); }\n        if ( url === docURL.href ) {\n            url = 'inlineScript';\n        } else if ( url.startsWith('<anonymous>') ) {\n            url = 'injectedScript';\n        }\n        let fn = match[1] !== undefined\n            ? match[1].slice(0, -1)\n            : line.slice(0, match.index).trim();\n        if ( fn.startsWith('at') ) { fn = fn.slice(2).trim(); }\n        let rowcol = match[3];\n        lines.push(' ' + `${fn} ${url}${rowcol}:1`.trim());\n    }\n    lines[0] = `stackDepth:${lines.length-1}`;\n    const stack = lines.join('\\t');\n    const r = needleDetails.matchAll !== true &&\n        safe.testPattern(needleDetails, stack);\n    if (\n        logLevel === 'all' ||\n        logLevel === 'match' && r ||\n        logLevel === 'nomatch' && !r\n    ) {\n        safe.uboLog(stack.replace(/\\t/g, '\\n'));\n    }\n    return r;\n}\n\nfunction objectFindOwnerFn(\n    root,\n    path,\n    prune = false\n) {\n    let owner = root;\n    let chain = path;\n    for (;;) {\n        if ( typeof owner !== 'object' || owner === null  ) { return false; }\n        const pos = chain.indexOf('.');\n        if ( pos === -1 ) {\n            if ( prune === false ) {\n                return owner.hasOwnProperty(chain);\n            }\n            let modified = false;\n            if ( chain === '*' ) {\n                for ( const key in owner ) {\n                    if ( owner.hasOwnProperty(key) === false ) { continue; }\n                    delete owner[key];\n                    modified = true;\n                }\n            } else if ( owner.hasOwnProperty(chain) ) {\n                delete owner[chain];\n                modified = true;\n            }\n            return modified;\n        }\n        const prop = chain.slice(0, pos);\n        const next = chain.slice(pos + 1);\n        let found = false;\n        if ( prop === '[-]' && Array.isArray(owner) ) {\n            let i = owner.length;\n            while ( i-- ) {\n                if ( objectFindOwnerFn(owner[i], next) === false ) { continue; }\n                owner.splice(i, 1);\n                found = true;\n            }\n            return found;\n        }\n        if ( prop === '{-}' && owner instanceof Object ) {\n            for ( const key of Object.keys(owner) ) {\n                if ( objectFindOwnerFn(owner[key], next) === false ) { continue; }\n                delete owner[key];\n                found = true;\n            }\n            return found;\n        }\n        if (\n            prop === '[]' && Array.isArray(owner) ||\n            prop === '{}' && owner instanceof Object ||\n            prop === '*' && owner instanceof Object\n        ) {\n            for ( const key of Object.keys(owner) ) {\n                if (objectFindOwnerFn(owner[key], next, prune) === false ) { continue; }\n                found = true;\n            }\n            return found;\n        }\n        if ( owner.hasOwnProperty(prop) === false ) { return false; }\n        owner = owner[prop];\n        chain = chain.slice(pos + 1);\n    }\n}\n\nfunction getExceptionToken() {\n    const token = getRandomToken();\n    const oe = self.onerror;\n    self.onerror = function(msg, ...args) {\n        if ( typeof msg === 'string' && msg.includes(token) ) { return true; }\n        if ( oe instanceof Function ) {\n            return oe.call(this, msg, ...args);\n        }\n    }.bind();\n    return token;\n}\n\nfunction getRandomToken() {\n    const safe = safeSelf();\n    return safe.String_fromCharCode(Date.now() % 26 + 97) +\n        safe.Math_floor(safe.Math_random() * 982451653 + 982451653).toString(36);\n}\n\ntry {\n// >>>> scriptlet start\n(function jsonPruneFetchResponse(...args) {\n    jsonPruneFetchResponseFn(...args);\n})(\"reelWatchSequenceResponse.entries.[-].command.reelWatchEndpoint.adClientParams.isAd entries.[-].command.reelWatchEndpoint.adClientParams.isAd\",\"\",\"propsToMatch\",\"url:/reel_watch_sequence?\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\nfunction setConstantFn(\n    trusted = false,\n    chain = '',\n    rawValue = ''\n) {\n    if ( chain === '' ) { return; }\n    const safe = safeSelf();\n    const logPrefix = safe.makeLogPrefix('set-constant', chain, rawValue);\n    const extraArgs = safe.getExtraArgs(Array.from(arguments), 3);\n    function setConstant(chain, rawValue) {\n        const trappedProp = (( ) => {\n            const pos = chain.lastIndexOf('.');\n            if ( pos === -1 ) { return chain; }\n            return chain.slice(pos+1);\n        })();\n        const cloakFunc = fn => {\n            safe.Object_defineProperty(fn, 'name', { value: trappedProp });\n            return new Proxy(fn, {\n                defineProperty(target, prop) {\n                    if ( prop !== 'toString' ) {\n                        return Reflect.defineProperty(...arguments);\n                    }\n                    return true;\n                },\n                deleteProperty(target, prop) {\n                    if ( prop !== 'toString' ) {\n                        return Reflect.deleteProperty(...arguments);\n                    }\n                    return true;\n                },\n                get(target, prop) {\n                    if ( prop === 'toString' ) {\n                        return function() {\n                            return `function ${trappedProp}() { [native code] }`;\n                        }.bind(null);\n                    }\n                    return Reflect.get(...arguments);\n                },\n            });\n        };\n        if ( trappedProp === '' ) { return; }\n        const thisScript = document.currentScript;\n        let normalValue = validateConstantFn(trusted, rawValue, extraArgs);\n        if ( rawValue === 'noopFunc' || rawValue === 'trueFunc' || rawValue === 'falseFunc' ) {\n            normalValue = cloakFunc(normalValue);\n        }\n        let aborted = false;\n        const mustAbort = function(v) {\n            if ( trusted ) { return false; }\n            if ( aborted ) { return true; }\n            aborted =\n                (v !== undefined && v !== null) &&\n                (normalValue !== undefined && normalValue !== null) &&\n                (typeof v !== typeof normalValue);\n            if ( aborted ) {\n                safe.uboLog(logPrefix, `Aborted because value set to ${v}`);\n            }\n            return aborted;\n        };\n        // https://github.com/uBlockOrigin/uBlock-issues/issues/156\n        //   Support multiple trappers for the same property.\n        const trapProp = function(owner, prop, configurable, handler) {\n            if ( handler.init(configurable ? owner[prop] : normalValue) === false ) { return; }\n            const odesc = safe.Object_getOwnPropertyDescriptor(owner, prop);\n            let prevGetter, prevSetter;\n            if ( odesc instanceof safe.Object ) {\n                owner[prop] = normalValue;\n                if ( odesc.get instanceof Function ) {\n                    prevGetter = odesc.get;\n                }\n                if ( odesc.set instanceof Function ) {\n                    prevSetter = odesc.set;\n                }\n            }\n            try {\n                safe.Object_defineProperty(owner, prop, {\n                    configurable,\n                    get() {\n                        if ( prevGetter !== undefined ) {\n                            prevGetter();\n                        }\n                        return handler.getter();\n                    },\n                    set(a) {\n                        if ( prevSetter !== undefined ) {\n                            prevSetter(a);\n                        }\n                        handler.setter(a);\n                    }\n                });\n                safe.uboLog(logPrefix, 'Trap installed');\n            } catch(ex) {\n                safe.uboErr(logPrefix, ex);\n            }\n        };\n        const trapChain = function(owner, chain) {\n            const pos = chain.indexOf('.');\n            if ( pos === -1 ) {\n                trapProp(owner, chain, false, {\n                    v: undefined,\n                    init: function(v) {\n                        if ( mustAbort(v) ) { return false; }\n                        this.v = v;\n                        return true;\n                    },\n                    getter: function() {\n                        if ( document.currentScript === thisScript ) {\n                            return this.v;\n                        }\n                        safe.uboLog(logPrefix, 'Property read');\n                        return normalValue;\n                    },\n                    setter: function(a) {\n                        if ( mustAbort(a) === false ) { return; }\n                        normalValue = a;\n                    }\n                });\n                return;\n            }\n            const prop = chain.slice(0, pos);\n            const v = owner[prop];\n            chain = chain.slice(pos + 1);\n            if ( v instanceof safe.Object || typeof v === 'object' && v !== null ) {\n                trapChain(v, chain);\n                return;\n            }\n            trapProp(owner, prop, true, {\n                v: undefined,\n                init: function(v) {\n                    this.v = v;\n                    return true;\n                },\n                getter: function() {\n                    return this.v;\n                },\n                setter: function(a) {\n                    this.v = a;\n                    if ( a instanceof safe.Object ) {\n                        trapChain(a, chain);\n                    }\n                }\n            });\n        };\n        trapChain(window, chain);\n    }\n    runAt(( ) => {\n        setConstant(chain, rawValue);\n    }, extraArgs.runAt);\n}\n\nfunction runAt(fn, when) {\n    const intFromReadyState = state => {\n        const targets = {\n            'loading': 1, 'asap': 1,\n            'interactive': 2, 'end': 2, '2': 2,\n            'complete': 3, 'idle': 3, '3': 3,\n        };\n        const tokens = Array.isArray(state) ? state : [ state ];\n        for ( const token of tokens ) {\n            const prop = `${token}`;\n            if ( targets.hasOwnProperty(prop) === false ) { continue; }\n            return targets[prop];\n        }\n        return 0;\n    };\n    const runAt = intFromReadyState(when);\n    if ( intFromReadyState(document.readyState) >= runAt ) {\n        fn(); return;\n    }\n    const onStateChange = ( ) => {\n        if ( intFromReadyState(document.readyState) < runAt ) { return; }\n        fn();\n        safe.removeEventListener.apply(document, args);\n    };\n    const safe = safeSelf();\n    const args = [ 'readystatechange', onStateChange, { capture: true } ];\n    safe.addEventListener.apply(document, args);\n}\n\nfunction validateConstantFn(trusted, raw, extraArgs = {}) {\n    const safe = safeSelf();\n    let value;\n    if ( raw === 'undefined' ) {\n        value = undefined;\n    } else if ( raw === 'false' ) {\n        value = false;\n    } else if ( raw === 'true' ) {\n        value = true;\n    } else if ( raw === 'null' ) {\n        value = null;\n    } else if ( raw === \"''\" || raw === '' ) {\n        value = '';\n    } else if ( raw === '[]' || raw === 'emptyArr' ) {\n        value = [];\n    } else if ( raw === '{}' || raw === 'emptyObj' ) {\n        value = {};\n    } else if ( raw === 'noopFunc' ) {\n        value = function(){};\n    } else if ( raw === 'trueFunc' ) {\n        value = function(){ return true; };\n    } else if ( raw === 'falseFunc' ) {\n        value = function(){ return false; };\n    } else if ( raw === 'throwFunc' ) {\n        value = function(){ throw ''; };\n    } else if ( /^-?\\d+$/.test(raw) ) {\n        value = parseInt(raw);\n        if ( isNaN(raw) ) { return; }\n        if ( Math.abs(raw) > 0x7FFF ) { return; }\n    } else if ( trusted ) {\n        if ( raw.startsWith('json:') ) {\n            try { value = safe.JSON_parse(raw.slice(5)); } catch(ex) { return; }\n        } else if ( raw.startsWith('{') && raw.endsWith('}') ) {\n            try { value = safe.JSON_parse(raw).value; } catch(ex) { return; }\n        }\n    } else {\n        return;\n    }\n    if ( extraArgs.as !== undefined ) {\n        if ( extraArgs.as === 'function' ) {\n            return ( ) => value;\n        } else if ( extraArgs.as === 'callback' ) {\n            return ( ) => (( ) => value);\n        } else if ( extraArgs.as === 'resolved' ) {\n            return Promise.resolve(value);\n        } else if ( extraArgs.as === 'rejected' ) {\n            return Promise.reject(value);\n        }\n    }\n    return value;\n}\n\ntry {\n// >>>> scriptlet start\n(function setConstant(\n    ...args\n) {\n    setConstantFn(false, ...args);\n})(\"playerResponse.adPlacements\",\"undefined\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function setConstant(\n    ...args\n) {\n    setConstantFn(false, ...args);\n})(\"ytInitialPlayerResponse.adPlacements\",\"undefined\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function setConstant(\n    ...args\n) {\n    setConstantFn(false, ...args);\n})(\"ytInitialPlayerResponse.adSlots\",\"undefined\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function setConstant(\n    ...args\n) {\n    setConstantFn(false, ...args);\n})(\"ytInitialPlayerResponse.playerAds\",\"undefined\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function jsonPruneFetchResponse(...args) {\n    jsonPruneFetchResponseFn(...args);\n})(\"playerAds adPlacements adSlots no_ads playerResponse.playerAds playerResponse.adPlacements playerResponse.adSlots playerResponse.no_ads [].playerResponse.adPlacements [].playerResponse.playerAds [].playerResponse.adSlots [].playerResponse.no_ads\",\"\",\"propsToMatch\",\"/\\\\/(player|get_watch)\\\\?/\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function jsonPruneFetchResponse(...args) {\n    jsonPruneFetchResponseFn(...args);\n})(\"playerAds adPlacements adSlots no_ads playerResponse.playerAds playerResponse.adPlacements playerResponse.adSlots playerResponse.no_ads\",\"\",\"propsToMatch\",\"/playlist?\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function jsonPruneXhrResponse(\n    rawPrunePaths = '',\n    rawNeedlePaths = ''\n) {\n    const safe = safeSelf();\n    const logPrefix = safe.makeLogPrefix('json-prune-xhr-response', rawPrunePaths, rawNeedlePaths);\n    const xhrInstances = new WeakMap();\n    const extraArgs = safe.getExtraArgs(Array.from(arguments), 2);\n    const propNeedles = parsePropertiesToMatch(extraArgs.propsToMatch, 'url');\n    const stackNeedle = safe.initPattern(extraArgs.stackToMatch || '', { canNegate: true });\n    self.XMLHttpRequest = class extends self.XMLHttpRequest {\n        open(method, url, ...args) {\n            const xhrDetails = { method, url };\n            let outcome = 'match';\n            if ( propNeedles.size !== 0 ) {\n                if ( matchObjectProperties(propNeedles, xhrDetails) === false ) {\n                    outcome = 'nomatch';\n                }\n            }\n            if ( outcome === 'match' ) {\n                if ( safe.logLevel > 1 ) {\n                    safe.uboLog(logPrefix, `Matched optional \"propsToMatch\", \"${extraArgs.propsToMatch}\"`);\n                }\n                xhrInstances.set(this, xhrDetails);\n            }\n            return super.open(method, url, ...args);\n        }\n        get response() {\n            const innerResponse = super.response;\n            const xhrDetails = xhrInstances.get(this);\n            if ( xhrDetails === undefined ) {\n                return innerResponse;\n            }\n            const responseLength = typeof innerResponse === 'string'\n                ? innerResponse.length\n                : undefined;\n            if ( xhrDetails.lastResponseLength !== responseLength ) {\n                xhrDetails.response = undefined;\n                xhrDetails.lastResponseLength = responseLength;\n            }\n            if ( xhrDetails.response !== undefined ) {\n                return xhrDetails.response;\n            }\n            let objBefore;\n            if ( typeof innerResponse === 'object' ) {\n                objBefore = innerResponse;\n            } else if ( typeof innerResponse === 'string' ) {\n                try {\n                    objBefore = safe.JSON_parse(innerResponse);\n                } catch(ex) {\n                }\n            }\n            if ( typeof objBefore !== 'object' ) {\n                return (xhrDetails.response = innerResponse);\n            }\n            const objAfter = objectPruneFn(\n                objBefore,\n                rawPrunePaths,\n                rawNeedlePaths,\n                stackNeedle,\n                extraArgs\n            );\n            let outerResponse;\n            if ( typeof objAfter === 'object' ) {\n                outerResponse = typeof innerResponse === 'string'\n                    ? safe.JSON_stringify(objAfter)\n                    : objAfter;\n                safe.uboLog(logPrefix, 'Pruned');\n            } else {\n                outerResponse = innerResponse;\n            }\n            return (xhrDetails.response = outerResponse);\n        }\n        get responseText() {\n            const response = this.response;\n            return typeof response !== 'string'\n                ? super.responseText\n                : response;\n        }\n    };\n})(\"playerAds adPlacements adSlots no_ads playerResponse.playerAds playerResponse.adPlacements playerResponse.adSlots playerResponse.no_ads [].playerResponse.adPlacements [].playerResponse.playerAds [].playerResponse.adSlots [].playerResponse.no_ads\",\"\",\"propsToMatch\",\"/\\\\/player(?:\\\\?.+)?$/\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function adjustSetTimeout(\n    needleArg = '',\n    delayArg = '',\n    boostArg = ''\n) {\n    if ( typeof needleArg !== 'string' ) { return; }\n    const safe = safeSelf();\n    const reNeedle = safe.patternToRegex(needleArg);\n    let delay = delayArg !== '*' ? parseInt(delayArg, 10) : -1;\n    if ( isNaN(delay) || isFinite(delay) === false ) { delay = 1000; }\n    let boost = parseFloat(boostArg);\n    boost = isNaN(boost) === false && isFinite(boost)\n        ? Math.min(Math.max(boost, 0.001), 50)\n        : 0.05;\n    self.setTimeout = new Proxy(self.setTimeout, {\n        apply: function(target, thisArg, args) {\n            const [ a, b ] = args;\n            if (\n                (delay === -1 || b === delay) &&\n                reNeedle.test(a.toString())\n            ) {\n                args[1] = b * boost;\n            }\n            return target.apply(thisArg, args);\n        }\n    });\n})(\"[native code]\",\"17000\",\"0.001\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\nfunction replaceFetchResponseFn(\n    trusted = false,\n    pattern = '',\n    replacement = '',\n    propsToMatch = ''\n) {\n    if ( trusted !== true ) { return; }\n    const safe = safeSelf();\n    const logPrefix = safe.makeLogPrefix('replace-fetch-response', pattern, replacement, propsToMatch);\n    if ( pattern === '*' ) { pattern = '.*'; }\n    const rePattern = safe.patternToRegex(pattern);\n    const propNeedles = parsePropertiesToMatch(propsToMatch, 'url');\n    const extraArgs = safe.getExtraArgs(Array.from(arguments), 4);\n    const reIncludes = extraArgs.includes ? safe.patternToRegex(extraArgs.includes) : null;\n    self.fetch = new Proxy(self.fetch, {\n        apply: function(target, thisArg, args) {\n            const fetchPromise = Reflect.apply(target, thisArg, args);\n            if ( pattern === '' ) { return fetchPromise; }\n            let outcome = 'match';\n            if ( propNeedles.size !== 0 ) {\n                const objs = [ args[0] instanceof Object ? args[0] : { url: args[0] } ];\n                if ( objs[0] instanceof Request ) {\n                    try {\n                        objs[0] = safe.Request_clone.call(objs[0]);\n                    }\n                    catch(ex) {\n                        safe.uboErr(logPrefix, ex);\n                    }\n                }\n                if ( args[1] instanceof Object ) {\n                    objs.push(args[1]);\n                }\n                if ( matchObjectProperties(propNeedles, ...objs) === false ) {\n                    outcome = 'nomatch';\n                }\n            }\n            if ( outcome === 'nomatch' ) { return fetchPromise; }\n            if ( safe.logLevel > 1 ) {\n                safe.uboLog(logPrefix, `Matched \"propsToMatch\"\\n${propsToMatch}`);\n            }\n            return fetchPromise.then(responseBefore => {\n                const response = responseBefore.clone();\n                return response.text().then(textBefore => {\n                    if ( reIncludes && reIncludes.test(textBefore) === false ) {\n                        return responseBefore;\n                    }\n                    const textAfter = textBefore.replace(rePattern, replacement);\n                    const outcome = textAfter !== textBefore ? 'match' : 'nomatch';\n                    if ( outcome === 'nomatch' ) { return responseBefore; }\n                    safe.uboLog(logPrefix, 'Replaced');\n                    const responseAfter = new Response(textAfter, {\n                        status: responseBefore.status,\n                        statusText: responseBefore.statusText,\n                        headers: responseBefore.headers,\n                    });\n                    Object.defineProperties(responseAfter, {\n                        ok: { value: responseBefore.ok },\n                        redirected: { value: responseBefore.redirected },\n                        type: { value: responseBefore.type },\n                        url: { value: responseBefore.url },\n                    });\n                    return responseAfter;\n                }).catch(reason => {\n                    safe.uboErr(logPrefix, reason);\n                    return responseBefore;\n                });\n            }).catch(reason => {\n                safe.uboErr(logPrefix, reason);\n                return fetchPromise;\n            });\n        }\n    });\n}\n\ntry {\n// >>>> scriptlet start\n(function trustedReplaceFetchResponse(...args) {\n    replaceFetchResponseFn(true, ...args);\n})(\"\\\"adPlacements\\\"\",\"\\\"no_ads\\\"\",\"player?\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function trustedReplaceFetchResponse(...args) {\n    replaceFetchResponseFn(true, ...args);\n})(\"\\\"adSlots\\\"\",\"\\\"no_ads\\\"\",\"player?\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function trustedReplaceXhrResponse(\n    pattern = '',\n    replacement = '',\n    propsToMatch = ''\n) {\n    const safe = safeSelf();\n    const logPrefix = safe.makeLogPrefix('trusted-replace-xhr-response', pattern, replacement, propsToMatch);\n    const xhrInstances = new WeakMap();\n    if ( pattern === '*' ) { pattern = '.*'; }\n    const rePattern = safe.patternToRegex(pattern);\n    const propNeedles = parsePropertiesToMatch(propsToMatch, 'url');\n    const extraArgs = safe.getExtraArgs(Array.from(arguments), 3);\n    const reIncludes = extraArgs.includes ? safe.patternToRegex(extraArgs.includes) : null;\n    self.XMLHttpRequest = class extends self.XMLHttpRequest {\n        open(method, url, ...args) {\n            const outerXhr = this;\n            const xhrDetails = { method, url };\n            let outcome = 'match';\n            if ( propNeedles.size !== 0 ) {\n                if ( matchObjectProperties(propNeedles, xhrDetails) === false ) {\n                    outcome = 'nomatch';\n                }\n            }\n            if ( outcome === 'match' ) {\n                if ( safe.logLevel > 1 ) {\n                    safe.uboLog(logPrefix, `Matched \"propsToMatch\"`);\n                }\n                xhrInstances.set(outerXhr, xhrDetails);\n            }\n            return super.open(method, url, ...args);\n        }\n        get response() {\n            const innerResponse = super.response;\n            const xhrDetails = xhrInstances.get(this);\n            if ( xhrDetails === undefined ) {\n                return innerResponse;\n            }\n            const responseLength = typeof innerResponse === 'string'\n                ? innerResponse.length\n                : undefined;\n            if ( xhrDetails.lastResponseLength !== responseLength ) {\n                xhrDetails.response = undefined;\n                xhrDetails.lastResponseLength = responseLength;\n            }\n            if ( xhrDetails.response !== undefined ) {\n                return xhrDetails.response;\n            }\n            if ( typeof innerResponse !== 'string' ) {\n                return (xhrDetails.response = innerResponse);\n            }\n            if ( reIncludes && reIncludes.test(innerResponse) === false ) {\n                return (xhrDetails.response = innerResponse);\n            }\n            const textBefore = innerResponse;\n            const textAfter = textBefore.replace(rePattern, replacement);\n            if ( textAfter !== textBefore ) {\n                safe.uboLog(logPrefix, 'Match');\n            }\n            return (xhrDetails.response = textAfter);\n        }\n        get responseText() {\n            const response = this.response;\n            if ( typeof response !== 'string' ) {\n                return super.responseText;\n            }\n            return response;\n        }\n    };\n})(\"/\\\"adPlacements.*?(\\\"adSlots\\\"|\\\"adBreakHeartbeatParams\\\")/gms\",\"$1\",\"/\\\\/player(?:\\\\?.+)?$/\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function trustedReplaceXhrResponse(\n    pattern = '',\n    replacement = '',\n    propsToMatch = ''\n) {\n    const safe = safeSelf();\n    const logPrefix = safe.makeLogPrefix('trusted-replace-xhr-response', pattern, replacement, propsToMatch);\n    const xhrInstances = new WeakMap();\n    if ( pattern === '*' ) { pattern = '.*'; }\n    const rePattern = safe.patternToRegex(pattern);\n    const propNeedles = parsePropertiesToMatch(propsToMatch, 'url');\n    const extraArgs = safe.getExtraArgs(Array.from(arguments), 3);\n    const reIncludes = extraArgs.includes ? safe.patternToRegex(extraArgs.includes) : null;\n    self.XMLHttpRequest = class extends self.XMLHttpRequest {\n        open(method, url, ...args) {\n            const outerXhr = this;\n            const xhrDetails = { method, url };\n            let outcome = 'match';\n            if ( propNeedles.size !== 0 ) {\n                if ( matchObjectProperties(propNeedles, xhrDetails) === false ) {\n                    outcome = 'nomatch';\n                }\n            }\n            if ( outcome === 'match' ) {\n                if ( safe.logLevel > 1 ) {\n                    safe.uboLog(logPrefix, `Matched \"propsToMatch\"`);\n                }\n                xhrInstances.set(outerXhr, xhrDetails);\n            }\n            return super.open(method, url, ...args);\n        }\n        get response() {\n            const innerResponse = super.response;\n            const xhrDetails = xhrInstances.get(this);\n            if ( xhrDetails === undefined ) {\n                return innerResponse;\n            }\n            const responseLength = typeof innerResponse === 'string'\n                ? innerResponse.length\n                : undefined;\n            if ( xhrDetails.lastResponseLength !== responseLength ) {\n                xhrDetails.response = undefined;\n                xhrDetails.lastResponseLength = responseLength;\n            }\n            if ( xhrDetails.response !== undefined ) {\n                return xhrDetails.response;\n            }\n            if ( typeof innerResponse !== 'string' ) {\n                return (xhrDetails.response = innerResponse);\n            }\n            if ( reIncludes && reIncludes.test(innerResponse) === false ) {\n                return (xhrDetails.response = innerResponse);\n            }\n            const textBefore = innerResponse;\n            const textAfter = textBefore.replace(rePattern, replacement);\n            if ( textAfter !== textBefore ) {\n                safe.uboLog(logPrefix, 'Match');\n            }\n            return (xhrDetails.response = textAfter);\n        }\n        get responseText() {\n            const response = this.response;\n            if ( typeof response !== 'string' ) {\n                return super.responseText;\n            }\n            return response;\n        }\n    };\n})(\"/\\\"adPlacements.*?([A-Z]\\\"\\\\}|\\\"\\\\}{2,4})\\\\}\\\\],/\",\"\",\"/playlist\\\\?list=|\\\\/player(?:\\\\?.+)?$|watch\\\\?[tv]=/\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\ntry {\n// >>>> scriptlet start\n(function jsonPrune(\n    rawPrunePaths = '',\n    rawNeedlePaths = '',\n    stackNeedle = ''\n) {\n    const safe = safeSelf();\n    const logPrefix = safe.makeLogPrefix('json-prune', rawPrunePaths, rawNeedlePaths, stackNeedle);\n    const stackNeedleDetails = safe.initPattern(stackNeedle, { canNegate: true });\n    const extraArgs = safe.getExtraArgs(Array.from(arguments), 3);\n    JSON.parse = new Proxy(JSON.parse, {\n        apply: function(target, thisArg, args) {\n            const objBefore = Reflect.apply(target, thisArg, args);\n            if ( rawPrunePaths === '' ) {\n                safe.uboLog(logPrefix, safe.JSON_stringify(objBefore, null, 2));\n            }\n            const objAfter = objectPruneFn(\n                objBefore,\n                rawPrunePaths,\n                rawNeedlePaths,\n                stackNeedleDetails,\n                extraArgs\n            );\n            if ( objAfter === undefined ) { return objBefore; }\n            safe.uboLog(logPrefix, 'Pruned');\n            if ( safe.logLevel > 1 ) {\n                safe.uboLog(logPrefix, `After pruning:\\n${safe.JSON_stringify(objAfter, null, 2)}`);\n            }\n            return objAfter;\n        },\n    });\n})(\"playerResponse.adPlacements playerResponse.playerAds playerResponse.adSlots adPlacements playerAds adSlots legacyImportant\");\n// <<<< scriptlet end\n} catch (e) {\n\n}\n\n// <<<< end of private namespace\n})();",
    "filters": "##+js(json-prune-fetch-response, reelWatchSequenceResponse.entries.[-].command.reelWatchEndpoint.adClientParams.isAd entries.[-].command.reelWatchEndpoint.adClientParams.isAd, '', propsToMatch, url:/reel_watch_sequence?)\n##+js(set-constant, playerResponse.adPlacements, undefined)\n##+js(set-constant, ytInitialPlayerResponse.adPlacements, undefined)\n##+js(set-constant, ytInitialPlayerResponse.adSlots, undefined)\n##+js(set-constant, ytInitialPlayerResponse.playerAds, undefined)\n##+js(json-prune-fetch-response, playerAds adPlacements adSlots no_ads playerResponse.playerAds playerResponse.adPlacements playerResponse.adSlots playerResponse.no_ads [].playerResponse.adPlacements [].playerResponse.playerAds [].playerResponse.adSlots [].playerResponse.no_ads, '', propsToMatch, /\\/(player|get_watch)\\?/)\n##+js(json-prune-fetch-response, playerAds adPlacements adSlots no_ads playerResponse.playerAds playerResponse.adPlacements playerResponse.adSlots playerResponse.no_ads, '', propsToMatch, /playlist?)\n##+js(json-prune-xhr-response, playerAds adPlacements adSlots no_ads playerResponse.playerAds playerResponse.adPlacements playerResponse.adSlots playerResponse.no_ads [].playerResponse.adPlacements [].playerResponse.playerAds [].playerResponse.adSlots [].playerResponse.no_ads, '', propsToMatch, /\\/player(?:\\?.+)?$/)\n##+js(adjust-setTimeout, [native code], 17000, 0.001)\n##+js(trusted-replace-fetch-response, '\"adPlacements\"', '\"no_ads\"', player?)\n##+js(trusted-replace-fetch-response, '\"adSlots\"', '\"no_ads\"', player?)\n##+js(trusted-replace-xhr-response, /\"adPlacements.*?(\"adSlots\"|\"adBreakHeartbeatParams\")/gms, $1, /\\/player(?:\\?.+)?$/)\n##+js(trusted-replace-xhr-response, '/\"adPlacements.*?([A-Z]\"\\}|\"\\}{2,4})\\}\\],/', '', /playlist\\?list=|\\/player(?:\\?.+)?$|watch\\?[tv]=/)\n##+js(trusted-replace-node-text, script, (function serverContract(), '/*START*/\"YOUTUBE_PREMIUM_LOGO\"!==ytInitialData?.topbar?.desktopTopbarRenderer?.logo?.topbarLogoRenderer?.iconImage?.iconType&&(location.href.startsWith(\"https://www.youtube.com/tv#/\")||location.href.startsWith(\"https://www.youtube.com/embed/\")||document.addEventListener(\"DOMContentLoaded\",(function(){const t=()=>{const t=document.getElementById(\"movie_player\");if(!t)return;if(!t.getStatsForNerds?.()?.debug_info?.startsWith?.(\"SSAP, AD\"))return;const e=t.getProgressState?.();e&&e.duration>0&&(e.loaded<e.duration||e.duration-e.current>1)&&t.seekTo?.(e.duration)};t(),new MutationObserver((()=>{t()})).observe(document,{childList:!0,subtree:!0})})));(function serverContract()', sedCount, 1)\n##+js(json-prune, playerResponse.adPlacements playerResponse.playerAds playerResponse.adSlots adPlacements playerAds adSlots legacyImportant)",
    "sentinel": "j1330k6qbr92mmifw6"
});

(function(details) {
    if (self.uBO_isolatedScriptlets === 'done') {
        return;
    }
    const doc = document;
    if (doc.location === null) {
        return;
    }
    const hostname = doc.location.hostname;
    if (hostname !== '' && details.hostname !== hostname) {
        return;
    }
    const isolatedScriptlets = function() {
        // >>>> start of private namespace

        ;

        const scriptletGlobals = {
            "warOrigin": "moz-extension://ad4b652f-1460-4f28-873d-bcee18d1e9e0/web_accessible_resources",
            "warSecret": "8sv4s1sysolpjcompj"
        }

        function replaceNodeTextFn(
            nodeName = '',
            pattern = '',
            replacement = ''
        ) {
            const safe = safeSelf();
            const logPrefix = safe.makeLogPrefix('replace-node-text.fn', ...Array.from(arguments));
            const reNodeName = safe.patternToRegex(nodeName, 'i', true);
            const rePattern = safe.patternToRegex(pattern, 'gms');
            const extraArgs = safe.getExtraArgs(Array.from(arguments), 3);
            const reIncludes = extraArgs.includes || extraArgs.condition ?
                safe.patternToRegex(extraArgs.includes || extraArgs.condition, 'ms') :
                null;
            const reExcludes = extraArgs.excludes ?
                safe.patternToRegex(extraArgs.excludes, 'ms') :
                null;
            const stop = (takeRecord = true) => {
                if (takeRecord) {
                    handleMutations(observer.takeRecords());
                }
                observer.disconnect();
                if (safe.logLevel > 1) {
                    safe.uboLog(logPrefix, 'Quitting');
                }
            };
            const textContentFactory = (() => {
                const out = {
                    createScript: s => s
                };
                const {
                    trustedTypes: tt
                } = self;
                if (tt instanceof Object) {
                    if (typeof tt.getPropertyType === 'function') {
                        if (tt.getPropertyType('script', 'textContent') === 'TrustedScript') {
                            return tt.createPolicy(getRandomToken(), out);
                        }
                    }
                }
                return out;
            })();
            let sedCount = extraArgs.sedCount || 0;
            const handleNode = node => {
                const before = node.textContent;
                if (reIncludes) {
                    reIncludes.lastIndex = 0;
                    if (safe.RegExp_test.call(reIncludes, before) === false) {
                        return true;
                    }
                }
                if (reExcludes) {
                    reExcludes.lastIndex = 0;
                    if (safe.RegExp_test.call(reExcludes, before)) {
                        return true;
                    }
                }
                rePattern.lastIndex = 0;
                if (safe.RegExp_test.call(rePattern, before) === false) {
                    return true;
                }
                rePattern.lastIndex = 0;
                const after = pattern !== '' ?
                    before.replace(rePattern, replacement) :
                    replacement;
                node.textContent = node.nodeName === 'SCRIPT' ?
                    textContentFactory.createScript(after) :
                    after;
                if (safe.logLevel > 1) {
                    safe.uboLog(logPrefix, `Text before:\n${before.trim()}`);
                }
                safe.uboLog(logPrefix, `Text after:\n${after.trim()}`);
                return sedCount === 0 || (sedCount -= 1) !== 0;
            };
            const handleMutations = mutations => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (reNodeName.test(node.nodeName) === false) {
                            continue;
                        }
                        if (handleNode(node)) {
                            continue;
                        }
                        stop(false);
                        return;
                    }
                }
            };
            const observer = new MutationObserver(handleMutations);
            observer.observe(document, {
                childList: true,
                subtree: true
            });
            if (document.documentElement) {
                const treeWalker = document.createTreeWalker(
                    document.documentElement,
                    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
                );
                let count = 0;
                for (;;) {
                    const node = treeWalker.nextNode();
                    count += 1;
                    if (node === null) {
                        break;
                    }
                    if (reNodeName.test(node.nodeName) === false) {
                        continue;
                    }
                    if (node === document.currentScript) {
                        continue;
                    }
                    if (handleNode(node)) {
                        continue;
                    }
                    stop();
                    break;
                }
                safe.uboLog(logPrefix, `${count} nodes present before installing mutation observer`);
            }
            if (extraArgs.stay) {
                return;
            }
            runAt(() => {
                const quitAfter = extraArgs.quitAfter || 0;
                if (quitAfter !== 0) {
                    setTimeout(() => {
                        stop();
                    }, quitAfter);
                } else {
                    stop();
                }
            }, 'interactive');
        }

        function getRandomToken() {
            const safe = safeSelf();
            return safe.String_fromCharCode(Date.now() % 26 + 97) +
                safe.Math_floor(safe.Math_random() * 982451653 + 982451653).toString(36);
        }

        function runAt(fn, when) {
            const intFromReadyState = state => {
                const targets = {
                    'loading': 1,
                    'asap': 1,
                    'interactive': 2,
                    'end': 2,
                    '2': 2,
                    'complete': 3,
                    'idle': 3,
                    '3': 3,
                };
                const tokens = Array.isArray(state) ? state : [state];
                for (const token of tokens) {
                    const prop = `${token}`;
                    if (targets.hasOwnProperty(prop) === false) {
                        continue;
                    }
                    return targets[prop];
                }
                return 0;
            };
            const runAt = intFromReadyState(when);
            if (intFromReadyState(document.readyState) >= runAt) {
                fn();
                return;
            }
            const onStateChange = () => {
                if (intFromReadyState(document.readyState) < runAt) {
                    return;
                }
                fn();
                safe.removeEventListener.apply(document, args);
            };
            const safe = safeSelf();
            const args = ['readystatechange', onStateChange, {
                capture: true
            }];
            safe.addEventListener.apply(document, args);
        }

        function safeSelf() {
            if (scriptletGlobals.safeSelf) {
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
                'String_split': String.prototype.split,
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
                    if (this.sendToLogger === undefined) {
                        return;
                    }
                    if (args === undefined || args[0] === '') {
                        return;
                    }
                    return this.sendToLogger('info', ...args);

                },
                uboErr(...args) {
                    if (this.sendToLogger === undefined) {
                        return;
                    }
                    if (args === undefined || args[0] === '') {
                        return;
                    }
                    return this.sendToLogger('error', ...args);
                },
                escapeRegexChars(s) {
                    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                },
                initPattern(pattern, options = {}) {
                    if (pattern === '') {
                        return {
                            matchAll: true,
                            expect: true
                        };
                    }
                    const expect = (options.canNegate !== true || pattern.startsWith('!') === false);
                    if (expect === false) {
                        pattern = pattern.slice(1);
                    }
                    const match = /^\/(.+)\/([gimsu]*)$/.exec(pattern);
                    if (match !== null) {
                        return {
                            re: new this.RegExp(
                                match[1],
                                match[2] || options.flags
                            ),
                            expect,
                        };
                    }
                    if (options.flags !== undefined) {
                        return {
                            re: new this.RegExp(this.escapeRegexChars(pattern),
                                options.flags
                            ),
                            expect,
                        };
                    }
                    return {
                        pattern,
                        expect
                    };
                },
                testPattern(details, haystack) {
                    if (details.matchAll) {
                        return true;
                    }
                    if (details.re) {
                        return this.RegExp_test.call(details.re, haystack) === details.expect;
                    }
                    return haystack.includes(details.pattern) === details.expect;
                },
                patternToRegex(pattern, flags = undefined, verbatim = false) {
                    if (pattern === '') {
                        return /^/;
                    }
                    const match = /^\/(.+)\/([gimsu]*)$/.exec(pattern);
                    if (match === null) {
                        const reStr = this.escapeRegexChars(pattern);
                        return new RegExp(verbatim ? `^${reStr}$` : reStr, flags);
                    }
                    try {
                        return new RegExp(match[1], match[2] || undefined);
                    } catch (ex) {}
                    return /^/;
                },
                getExtraArgs(args, offset = 0) {
                    const entries = args.slice(offset).reduce((out, v, i, a) => {
                        if ((i & 1) === 0) {
                            const rawValue = a[i + 1];
                            const value = /^\d+$/.test(rawValue) ?
                                parseInt(rawValue, 10) :
                                rawValue;
                            out.push([a[i], value]);
                        }
                        return out;
                    }, []);
                    return this.Object_fromEntries(entries);
                },
                onIdle(fn, options) {
                    if (self.requestIdleCallback) {
                        return self.requestIdleCallback(fn, options);
                    }
                    return self.requestAnimationFrame(fn);
                },
                offIdle(id) {
                    if (self.requestIdleCallback) {
                        return self.cancelIdleCallback(id);
                    }
                    return self.cancelAnimationFrame(id);
                }
            };
            scriptletGlobals.safeSelf = safe;
            if (scriptletGlobals.bcSecret === undefined) {
                return safe;
            }
            // This is executed only when the logger is opened
            safe.logLevel = scriptletGlobals.logLevel || 1;
            let lastLogType = '';
            let lastLogText = '';
            let lastLogTime = 0;
            safe.toLogText = (type, ...args) => {
                if (args.length === 0) {
                    return;
                }
                const text = `[${document.location.hostname || document.location.href}]${args.join(' ')}`;
                if (text === lastLogText && type === lastLogType) {
                    if ((Date.now() - lastLogTime) < 5000) {
                        return;
                    }
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
                    if (text === undefined) {
                        return;
                    }
                    if (bcBuffer === undefined) {
                        return bc.postMessage({
                            what: 'messageToLogger',
                            type,
                            text
                        });
                    }
                    bcBuffer.push({
                        type,
                        text
                    });
                };
                bc.onmessage = ev => {
                    const msg = ev.data;
                    switch (msg) {
                        case 'iamready!':
                            if (bcBuffer === undefined) {
                                break;
                            }
                            bcBuffer.forEach(({
                                    type,
                                    text
                                }) =>
                                bc.postMessage({
                                    what: 'messageToLogger',
                                    type,
                                    text
                                })
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
            } catch (_) {
                safe.sendToLogger = (type, ...args) => {
                    const text = safe.toLogText(type, ...args);
                    if (text === undefined) {
                        return;
                    }
                    safe.log(`uBO ${text}`);
                };
            }
            return safe;
        }

        try {
            // >>>> scriptlet start
            (function replaceNodeText(
                nodeName,
                pattern,
                replacement,
                ...extraArgs
            ) {
                replaceNodeTextFn(nodeName, pattern, replacement, ...extraArgs);
            })("script", "(function serverContract()", "/*START*/\"YOUTUBE_PREMIUM_LOGO\"!==ytInitialData?.topbar?.desktopTopbarRenderer?.logo?.topbarLogoRenderer?.iconImage?.iconType&&(location.href.startsWith(\"https://www.youtube.com/tv#/\")||location.href.startsWith(\"https://www.youtube.com/embed/\")||document.addEventListener(\"DOMContentLoaded\",(function(){const t=()=>{const t=document.getElementById(\"movie_player\");if(!t)return;if(!t.getStatsForNerds?.()?.debug_info?.startsWith?.(\"SSAP, AD\"))return;const e=t.getProgressState?.();e&&e.duration>0&&(e.loaded<e.duration||e.duration-e.current>1)&&t.seekTo?.(e.duration)};t(),new MutationObserver((()=>{t()})).observe(document,{childList:!0,subtree:!0})})));(function serverContract()", "sedCount", "1");
            // <<<< scriptlet end
        } catch (e) {

        }

        // <<<< end of private namespace
    };
    isolatedScriptlets();
    self.uBO_isolatedScriptlets = 'done';
    return 0;
})({
    "hostname": "www.youtube.com"
});