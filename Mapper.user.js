// ==UserScript==
// @name        Mapper
// @description Redirect Google Maps Links
// @include *://*.google.*/*
// @run-at document-start
// ==/UserScript==

(function() {
    // Only on Google domains
    if (!/^(.+\.)?google\.[a-z\.]+$/.test(window.location.hostname)) return;
    const url = window.location.href;

    // Helper: extract search query
    function getSearch() {
        const input = document.querySelector('input[name="q"]');
        return input ? input.value.trim() : '';
    }

    // Helper: convert Google URL to maps:// deep link
    function getAppleURL(googleURL) {
        if (googleURL.includes('maps.apple.com')) return googleURL;
        let address = googleURL.split('/data=')[0]
            .replace(/^https?:\/\/maps\.google\.com\/maps\/dir\/\//, '')
            .replace(/^https?:\/\/maps\.google\.com\/maps\/dir\//, '')
            .replace(/^https?:\/\/maps\.google\.com\/maps\/place\/\//, '')
            .replace(/^https?:\/\/maps\.google\.com\/maps\/place\//, '');
        let appleURL;
        if (address.includes('/') && !address.includes('@')) {
            const [from, to] = address.split('/');
            appleURL = `maps://?saddr=${encodeURIComponent(from)}&daddr=${encodeURIComponent(to)}`;
        } else if (address.includes('@')) {
            const place = address.split('/')[0];
            appleURL = `maps://?q=${encodeURIComponent(place)}`;
        } else {
            appleURL = `maps://?q=${encodeURIComponent(address)}`;
        }
        return appleURL;
    }

    // Fix links on Google Search
    if (url.includes('/search')) {
        setInterval(fixLinks, 1000);
    }

    function fixLinks() {
        // 1) Rewrite any data-url or data-link anchors
        document.querySelectorAll(
            'a[data-url*="maps.google."], div[data-link*="maps.google."]'
        ).forEach(el => {
            const src = el.dataset.url || el.dataset.link;
            const newURL = getAppleURL(src);
            el.href = newURL;
            el.dataset.url = newURL;
            el.dataset.link = newURL;
            el.ping = newURL;
            el.removeAttribute('data-jsarwt');
        });

        // 2) Intercept only the “Directions” buttons
        [...document.getElementsByClassName('FFdnyb'),
          ...document.getElementsByClassName('P6Deab')]
        .forEach(btn => {
            const label = btn.querySelector('.JWyTcc')?.textContent.trim();
            if (label === 'Directions' && !btn.classList.contains('customDirectionsLink')) {
                const spanOld = document.querySelector('.M2Cv8e.xPwsMd span');
                const spanNew = document.querySelector('.C9waJd.y7xX3d span');
                const address = spanOld
                    ? spanOld.textContent.trim()
                    : spanNew
                        ? spanNew.textContent.trim()
                        : getSearch();

                btn.classList.add('customDirectionsLink');
                ['role','data-ved','jsdata','jscontroller','jsaction','data-jsarwt']
                    .forEach(attr => btn.removeAttribute(attr));

                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    window.location.href = `maps://?q=${encodeURIComponent(address)}`;
                }, true);
            }
        });

        // 3) Rewrite address text & thumbnail links (all layouts)
        const spanOld = document.querySelector('.M2Cv8e.xPwsMd span');
        const spanNew = document.querySelector('.C9waJd.y7xX3d span');
        const addrText = spanOld
            ? spanOld.textContent.trim()
            : spanNew
                ? spanNew.textContent.trim()
                : '';
        if (addrText) {
            const deepLink = `maps://?q=${encodeURIComponent(addrText)}`;
            document.querySelectorAll(
                '.gqkR3b > a, .tIMEcc a, a.zfFVc, div.cBxpYb > a.zfFVc, div.JJ1qle > a'
            ).forEach(a => {
                a.href = deepLink;
                a.dataset.url = deepLink;
                a.ping = deepLink;
                a.removeAttribute('data-jsarwt');
            });
        }
    }

    // On Google Maps web app
    if (url.includes('/maps')) {
        setTimeout(() => {
            const loc = document.querySelector('.DUwDvf');
            if (loc) {
                window.location.href = `maps://?q=${encodeURIComponent(loc.textContent.trim())}`;
            } else {
                fixMapsURL(location.pathname + location.search);
            }
        }, 250);
    }

    function fixMapsURL(pathsearch) {
        let newURL = '';
        if (pathsearch.includes('/maps/dir/')) {
            const parts = pathsearch.split('/maps/dir/')[1].split('/');
            const [from, to] = parts;
            newURL = `maps://?saddr=${encodeURIComponent(from)}&daddr=${encodeURIComponent(to)}`;
        } else if (pathsearch.includes('?')) {
            const params = new URLSearchParams(pathsearch.split('?')[1]);
            if (params.has('q')) {
                newURL = `maps://?q=${encodeURIComponent(params.get('q'))}`;
            } else {
                const s = params.get('saddr'), d = params.get('daddr');
                newURL = `maps://?saddr=${encodeURIComponent(s)}&daddr=${encodeURIComponent(d)}`;
            }
        } else if (pathsearch.includes('/place/')) {
            const place = pathsearch.split('/maps/place/')[1].split('/')[0];
            newURL = `maps://?q=${encodeURIComponent(place)}`;
        }
        if (newURL) window.location.href = newURL;
    }
})();