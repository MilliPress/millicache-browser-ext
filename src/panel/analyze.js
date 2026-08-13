/**
 * Turns a DevTools network request into a normalized observation. Pure: no DOM,
 * no timers, no globals, so it runs against recorded fixtures without a browser.
 *
 * Everything hinges on `edge.originFresh`. On an edge hit the MilliCache headers
 * are a replay of the fill request, so status, expiry, transitions and savings
 * are only trustworthy when the origin produced this response.
 */

import { detectEdge, isContentFlag } from "./providers.js";

const MILLI_PREFIX = "x-millicache-";

// Headers MilliCache only emits with debug mode enabled.
const DEBUG_HEADER_NAMES = ["key", "time", "flags", "gzip", "reason", "expires"];

// "bypass" is only interesting on the main document; on subresources it is noise.
const RENDERABLE_STATUSES = ["hit", "miss", "stale"];

/**
 * Cross-request state. Only origin-produced responses are recorded, so an edge
 * replay cannot poison a baseline.
 *
 * @returns {object} Empty state.
 */
export function createState() {
  return {
    lastStatus: new Map(),
    missTtfb: new Map(),
    originTtfb: new Map()
  };
}

/**
 * Index a DevTools header list by lowercased name, keeping repeats: the Tagger
 * appends Cache-Control, so `private` and `s-maxage` can arrive on separate
 * lines and a first-wins lookup would miss one.
 *
 * @param {Array<{name: string, value: string}>} headers Response headers.
 * @returns {object} Index with has/get/getAll/names.
 */
export function createHeaderIndex(headers) {
  const map = new Map();

  (headers || []).forEach(header => {
    const name = String(header.name || "").toLowerCase();
    const existing = map.get(name);
    if (existing) {
      existing.push(header.value);
    } else {
      map.set(name, [header.value]);
    }
  });

  return {
    has: name => map.has(name),
    get: name => {
      const values = map.get(name);
      return values ? values[0] : null;
    },
    getAll: name => map.get(name) || [],
    names: () => Array.from(map.keys())
  };
}

/**
 * Read the MilliCache headers off a response.
 *
 * @param {object} index Header index.
 * @returns {object} Origin observation; absent values are empty strings, or
 *   null for gzip.
 */
export function readOriginHeaders(index) {
  const present = index.names().filter(name => name.startsWith(MILLI_PREFIX));
  const read = key => index.get(MILLI_PREFIX + key) || "";

  const flagsValue = read("flags");
  const gzipValue = index.get(MILLI_PREFIX + "gzip");
  const status = read("status");

  return {
    present,
    status,
    statusValue: status.toLowerCase(),
    key: read("key"),
    time: read("time"),
    reason: read("reason"),
    expires: read("expires"),
    flags: flagsValue ? flagsValue.split(" ").filter(isContentFlag) : [],
    gzip: gzipValue === null ? null : gzipValue === "true",
    hasDebugHeaders: DEBUG_HEADER_NAMES.some(name => index.has(MILLI_PREFIX + name))
  };
}

/**
 * Parse MilliCache's "0d 00h 09m 31s" duration into seconds.
 *
 * @param {string} value Formatted duration, or a bare number of seconds.
 * @returns {number|null} Seconds (negative when already expired), or null.
 */
export function parseDuration(value) {
  const match = value.match(/(?:(-)?(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/);

  if (match && match[0] !== "") {
    const total = (parseInt(match[2] || 0, 10) * 86400) +
      (parseInt(match[3] || 0, 10) * 3600) +
      (parseInt(match[4] || 0, 10) * 60) +
      parseInt(match[5] || 0, 10);

    return match[1] === "-" ? -total : total;
  }

  const seconds = parseInt(value, 10);
  return Number.isNaN(seconds) ? null : seconds;
}

/**
 * Label the change between two cache statuses.
 *
 * @param {string} prevStatus Previous status.
 * @param {string} newStatus Current status.
 * @returns {string|null}
 */
export function getTransitionLabel(prevStatus, newStatus) {
  const prev = prevStatus.toLowerCase();
  const next = newStatus.toLowerCase();
  if (prev === "miss" && next === "hit") return "cached";
  if (prev === "hit" && next === "stale") return "expired";
  if (prev === "hit" && next === "miss") return "cleared";
  if (prev === "stale" && next === "hit") return "regenerated";
  if (prev === "miss" && next === "stale") return "stale";
  return null;
}

/**
 * When the origin entry actually expires.
 *
 * `X-MilliCache-Expires` is relative to when the origin wrote it, so on an edge
 * hit "9m 31s left" means 9m 31s from the fill. Resolved most precise first:
 * relative to now when the origin answered; else entry time + s-maxage or the
 * edge's fill timestamp, both absolute; else Age, which understates it.
 *
 * @param {object} origin Origin observation.
 * @param {object} edge Edge observation.
 * @param {number} now Current epoch ms.
 * @returns {object|null} {targetTime, approximate} or {text} when unresolvable.
 */
export function resolveExpiry(origin, edge, now = Date.now()) {
  if (!origin.expires) return null;

  const seconds = parseDuration(origin.expires);
  if (seconds === null) return { text: origin.expires };

  if (edge.originFresh === true) {
    return { targetTime: now + (seconds * 1000), approximate: false };
  }

  const updatedAt = origin.time ? Date.parse(origin.time) : NaN;
  if (!Number.isNaN(updatedAt) && edge.sMaxAge !== null) {
    return { targetTime: updatedAt + (edge.sMaxAge * 1000), approximate: false };
  }

  if (edge.cachedAt !== null) {
    return { targetTime: edge.cachedAt + (seconds * 1000), approximate: false };
  }

  if (edge.age !== null) {
    return { targetTime: now + (seconds * 1000) - (edge.age * 1000), approximate: true };
  }

  return { text: origin.expires, approximate: true };
}

/**
 * Did MilliCache's own cache help, and did the edge help? Only origin-produced
 * responses feed the baselines; edge-against-edge measures network noise.
 *
 * @param {object} state Analyzer state.
 * @param {string} url Request URL.
 * @param {object} origin Origin observation.
 * @param {object} edge Edge observation.
 * @param {number|null|undefined} ttfb Time to first byte in ms.
 * @returns {{origin: object|null, edge: object|null}}
 */
function resolveSavings(state, url, origin, edge, ttfb) {
  const result = { origin: null, edge: null };
  if (ttfb === null || ttfb === undefined) return result;

  const originProduced = edge.originFresh === true;

  if (originProduced) {
    state.originTtfb.set(url, ttfb);

    if (origin.statusValue === "miss") {
      state.missTtfb.set(url, { ttfb, url, timestamp: Date.now() });
      return result;
    }

    if ((origin.statusValue === "hit" || origin.statusValue === "stale") && state.missTtfb.has(url)) {
      result.origin = compare(state.missTtfb.get(url).ttfb, ttfb);
    }

    return result;
  }

  // Edge-served: size it against the last time the origin answered.
  if (edge.originFresh === false && state.originTtfb.has(url)) {
    result.edge = compare(state.originTtfb.get(url), ttfb);
  }

  return result;
}

/**
 * @param {number} baseline Baseline TTFB in ms.
 * @param {number} current Current TTFB in ms.
 * @returns {object}
 */
function compare(baseline, current) {
  const timeSaved = baseline - current;

  return {
    timeSaved,
    percentSaved: baseline > 0 ? Math.round((timeSaved / baseline) * 100) : 0,
    missTtfb: baseline,
    hitTtfb: current
  };
}

/**
 * Edge-cache misconfigurations that are invisible in the network panel.
 *
 * @param {object} origin Origin observation.
 * @param {object} edge Edge observation.
 * @param {boolean} isMainDocument Whether this is the navigated document.
 * @returns {Array<{level: string, text: string}>}
 */
export function buildDiagnostics(origin, edge, isMainDocument) {
  const notes = [];

  // A response nobody intends the edge to store. Missing tags and lifetimes are
  // the expected shape of that, not something to report.
  const notStored = edge.isPrivate ||
    origin.statusValue === "bypass" ||
    edge.status === "bypass";

  if (edge.isPrivate) {
    notes.push({
      level: "info",
      text: origin.reason
        ? `Kept off the edge on purpose (private): ${origin.reason}`
        : "Kept off the edge on purpose (Cache-Control: private)."
    });
  }

  if (edge.vary) {
    notes.push({ level: "info", text: `Edge-cached as a variant, keyed by Vary: ${edge.vary}.` });
  }

  if (!edge.detected) return notes;

  if (isMainDocument && edge.providerId === "cloudflare" && edge.status === "dynamic") {
    notes.push({
      level: "warn",
      text: "Cloudflare is not caching this page (DYNAMIC). No Cache Rule makes the HTML eligible."
    });
  }

  // Absent s-maxage does not mean the origin sent none. bunny.net replaces the
  // client-facing Cache-Control when a pull zone sets Browser Cache Expiration
  // Time, so a zone can be honouring an s-maxage the browser never sees. Its own
  // tag header arriving is the tell: the Tagger emits both together, so a tag
  // without a lifetime points at the zone rewriting the header rather than at
  // MilliCache omitting it.
  if (isMainDocument && !notStored && edge.sMaxAge === null) {
    const rewritten = edge.providerId === "bunny" && edge.tags.length > 0;

    notes.push({
      level: "info",
      text: rewritten
        ? "No s-maxage is visible, but bunny.net replaces Cache-Control for the browser when the pull zone sets a Browser Cache Expiration Time. MilliCache may still be setting one that the edge honours."
        : "No s-maxage on the response, so the pull zone's own expiry setting decides how long the edge keeps this page."
    });
  }

  if (edge.age !== null && edge.sMaxAge !== null && edge.age > edge.sMaxAge) {
    notes.push({
      level: "warn",
      text: `The edge copy is ${edge.age - edge.sMaxAge}s past its s-maxage and is being served stale.`
    });
  }

  if (!notStored && !edge.tags.length) {
    if (edge.providerId === "bunny") {
      notes.push({
        level: "warn",
        text: "No CDN-Tag on this response, so the page is stored untagged and flag purges cannot clear it."
      });
    } else if (edge.providerId === "cloudflare") {
      notes.push({
        level: "info",
        text: "Cloudflare strips Cache-Tag before the browser sees it. Enable \"Host CDN compatibility\" in the MilliCache Pro settings to verify tags here."
      });
    }
  }

  // Only comparable when the origin wrote both sides.
  if (edge.originFresh === true && edge.tags.length && origin.flags.length) {
    const tagged = new Set(edge.tags);
    const missing = origin.flags.filter(flag => !tagged.has(flag));
    if (missing.length) {
      notes.push({
        level: "warn",
        text: `Flags missing from the edge tag: ${missing.join(", ")}.`
      });
    }
  }

  return notes;
}

/**
 * Analyze one finished request.
 *
 * @param {object} request DevTools HAR entry.
 * @param {object} state Analyzer state from createState().
 * @param {{lastNavigatedUrl: string|null}} context Panel navigation context.
 * @returns {object|null} An observation, or null when ignored. `verdict` is
 *   "no-millicache", "unsupported-status", or "render".
 */
export function analyze(request, state, context) {
  const url = request.request.url;

  if (/favicon\.ico([?#].*)?$/.test(new URL(url).pathname)) {
    return null;
  }

  const index = createHeaderIndex(request.response.headers);
  const edge = detectEdge(index);
  const origin = readOriginHeaders(index);

  const isMainDocument = Boolean(context.lastNavigatedUrl) && url === context.lastNavigatedUrl;

  const base = {
    url,
    httpStatus: request.response.status,
    isMainDocument,
    edge,
    origin
  };

  if (!origin.status) {
    return { ...base, verdict: "no-millicache" };
  }

  const isRenderable = RENDERABLE_STATUSES.includes(origin.statusValue) ||
    (origin.statusValue === "bypass" && isMainDocument);

  if (!isRenderable) {
    return { ...base, verdict: "unsupported-status" };
  }

  // Not on a MISS, which carries no entry details, nor behind an edge hit,
  // where missing headers say nothing about the origin's settings.
  let debugNotice = null;
  if (origin.hasDebugHeaders) {
    debugNotice = "hide";
  } else if (origin.present.length === 1 && origin.statusValue !== "miss" && edge.originFresh === true) {
    debugNotice = "show";
  }

  const ttfb = request.timings?.wait;
  const savings = resolveSavings(state, url, origin, edge, ttfb);

  // Only real when both sides came from the origin; an edge alternating between
  // HIT and MISS would otherwise fake one on every reload.
  let transitionLabel = null;
  if (edge.originFresh === true) {
    const previousStatus = state.lastStatus.get(url);
    transitionLabel = previousStatus ? getTransitionLabel(previousStatus, origin.status) : null;
    state.lastStatus.set(url, origin.statusValue);
  }

  return {
    ...base,
    verdict: "render",
    ttfb,
    savings,
    transitionLabel,
    debugNotice,
    expiry: resolveExpiry(origin, edge),
    diagnostics: buildDiagnostics(origin, edge, isMainDocument),
    // The status describing what the visitor actually got.
    effectiveStatus: edge.originFresh === false && edge.status ? edge.status : origin.statusValue,
    // Anything not definitively origin-produced counts as edge, so origin
    // values are shown only when they can be vouched for.
    servedBy: edge.detected && edge.originFresh !== true ? "edge" : "origin"
  };
}
