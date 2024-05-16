
const config = {
  plausibleDomain: "seusite.deco.site",
  decoDomain: "https://seusite.deco.site"
}

const plausibleAttributes = {
    "data-domain": config.plausibleDomain,
    "data-api": "https://plausible.io/api/event",
    "src": "https://plausible.io/js/script.manual.hash.js",
    "defer": "true"
}

function addPlausible() {
    let newScript = document.createElement('script');
    for (const [key, value] of Object.entries(plausibleAttributes)) {
        newScript.setAttribute(key, value);
    }
    document.head.appendChild(newScript);
}

function runJS(jsToRun) {
    eval(jsToRun)
}

function addCSS(cssToAdd) {
    var style = document.createElement('style');
    style.type = 'text/css';

    if (style.styleSheet) {
        // This is required for IE8 and below.
        style.styleSheet.cssText = cssToAdd;
    } else {
        style.appendChild(document.createTextNode(cssToAdd));
    }
    document.head.appendChild(style);
}

function trackElements(elementsToTrack, flags) {
    elementsToTrack.forEach(element => {
        const elements = document.querySelectorAll(element.cssSelector)
        elements.forEach(el => {
            el.addEventListener(element.eventType, () => {
                globalThis.window.DECO.sendEvent?.(element.eventName)
            })
        })
    })
}

async function fetchScript() {
    const response = await fetch(`${config.decoDomain}/live/invoke/abTest`);

    const result = await response.json();
    const flags = parseFlags();
    let configIndex = flags[result.name] ? 1 : 0;

    if (flags[result.name] === null || flags[result.name] === undefined) {
        const renderVariant = randomMatcher({ traffic: 0.5 }) ? 1 : 0;
        configIndex = renderVariant ? 1 : 0;
        setFlags(document.cookie, [{ name: result.name, value: renderVariant, isSegment: true }])
    }

    const jsToRun = result.variants[configIndex].injectedScript
    const cssToAdd = result.variants[configIndex].injectedStyle
    const elementsToTrack = result.trackedElements

    addPlausible()

    try {
        runJS(jsToRun)

    } catch (e) {
        console.error(e)
    }
    try {
        addCSS(cssToAdd)
    } catch (e) {
        console.error(e)
    }
    try {
        window.addEventListener("load", (event) => {
            trackElements(elementsToTrack, flags)
        })
    } catch (e) {
        console.error(e)
    }

    // wait plausible load
    await sleep(500)

    globalThis.window.DECO = globalThis.window.DECO || {};
    globalThis.window.DECO.sendEvent = (name, props) => {
        console.log(event)
        const flags = parseFlags();
        globalThis.window.plausible?.(name, {
            props: {
                ...(props || {}),
                ...flags
            }
        });
    }

    const trackPageview = () => globalThis.window.DECO.sendEvent?.("pageview");
    // First pageview
    trackPageview()
}

fetchScript()

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const DECO_SEGMENT = "deco_segment";

const parseFlags = () => {
    const _flags = getFlagsFromCookies(parseCookies(document.cookie));
    const flags = {};
    _flags.forEach((flag) => flags[flag.name] = flag.value);
    return flags;
}

const getFlagsFromCookies = (cookies) => {
    const flags = [];
    const segment = cookies[DECO_SEGMENT]
        ? tryOrDefault(
            () => JSON.parse(decodeURIComponent(atob(cookies[DECO_SEGMENT]))),
            {},
        )
        : {};

    segment.active?.forEach((flag) =>
        flags.push({ name: flag, value: true })
    );
    segment.inactiveDrawn?.forEach((flag) =>
        flags.push({ name: flag, value: false })
    );

    return flags;
};

const setFlags = (cookie, flags) => {
    const cookieSegment = tryOrDefault(
        () => decodeCookie(parseCookies(cookie)[DECO_SEGMENT]),
        "",
    );

    const segment = tryOrDefault(() => JSON.parse(cookieSegment), {});

    const active = new Set(segment.active || []);
    const inactiveDrawn = new Set(segment.inactiveDrawn || []);
    for (const flag of flags) {
        if (flag.isSegment) {
            if (flag.value) {
                active.add(flag.name);
                inactiveDrawn.delete(flag.name);
            } else {
                active.delete(flag.name);
                inactiveDrawn.add(flag.name);
            }
        }
    }
    const newSegment = {
        active: [...active].sort(),
        inactiveDrawn: [...inactiveDrawn].sort(),
    };
    const value = JSON.stringify(newSegment);
    const hasFlags = active.size > 0 || inactiveDrawn.size > 0;

    if (hasFlags && cookieSegment !== value) {
        setCookie(DECO_SEGMENT, btoa(encodeURIComponent(value)), 365);
    }
};

const parseCookies = (cookieString) => {
    const cookies = {};
    cookieString.split(";").forEach((cookie) => {
        const [key, value] = cookie.split("=").map((c) => c.trim());
        cookies[key] = value;
    });
    return cookies;
};

const tryOrDefault = (fn, defaultValue) => {
    try {
        return fn();
    } catch {
        return defaultValue;
    }
};

const decodeCookie = (cookie) => {
    return decodeURIComponent(atob(cookie));
};

const setCookie = (name, value, days) => {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
};

const randomMatcher = ({ traffic }) => {
    return Math.random() < traffic;
}