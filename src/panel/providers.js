/**
 * Edge/CDN provider descriptors.
 *
 * A CDN stores whatever it saw on the wire, X-MilliCache-* headers included, so
 * an edge object replays the one origin request that filled it. Each descriptor
 * reports `originFresh`: did the origin produce THIS response (true, headers are
 * live), did the edge serve stored bytes (false, headers are a replay), or is
 * the status unrecognised (null).
 *
 * Header names and formats for both providers are confirmed against live zones
 * (see tests/fixtures.js).
 */

/**
 * "url:" flags identify one entry, not its content. MilliCache appends them
 * unprefixed, multisite included (Response\Processor::collect_flags).
 *
 * @param {string} flag Flag or tag.
 * @returns {boolean}
 */
export function isContentFlag(flag) {
  return !flag.startsWith("url:");
}

/**
 * @param {string} status Lowercased edge cache status.
 * @param {Set<string>} fromOrigin Statuses guaranteeing a full origin response.
 * @param {Set<string>} fromEdge Statuses where the edge served stored bytes.
 * @returns {boolean|null}
 */
function originFreshness(status, fromOrigin, fromEdge) {
  if (!status) return null;
  if (fromOrigin.has(status)) return true;
  if (fromEdge.has(status)) return false;
  return null;
}

// "expired" counts as origin-served: MilliCache's Cleaner unsets
// If-None-Match/If-Modified-Since, so no revalidation can be answered with a
// 304. "revalidated" is Cloudflare's status for that 304.
const CF_FROM_ORIGIN = new Set(["miss", "expired", "dynamic", "bypass", "none", "ignored"]);
const CF_FROM_EDGE = new Set(["hit", "stale", "updating", "revalidated"]);

const BUNNY_FROM_ORIGIN = new Set(["miss", "expired", "bypass"]);
const BUNNY_FROM_EDGE = new Set(["hit", "stale", "updating"]);

const GENERIC_FROM_ORIGIN = new Set(["miss", "bypass", "dynamic", "expired"]);
const GENERIC_FROM_EDGE = new Set(["hit", "stale"]);

const CLOUDFLARE = {
  id: "cloudflare",
  name: "Cloudflare",

  detect(index) {
    return index.has("cf-ray") || index.has("cf-cache-status");
  },

  status(index) {
    return (index.get("cf-cache-status") || "").trim().toLowerCase();
  },

  originFresh(status) {
    return originFreshness(status, CF_FROM_ORIGIN, CF_FROM_EDGE);
  },

  // cf-ray is "<id>-<colo>", e.g. "8f2c1a9b0d3e4f56-FRA".
  pop(index) {
    const ray = index.get("cf-ray");
    if (!ray) return "";
    const parts = ray.trim().split("-");
    return parts.length > 1 ? parts[parts.length - 1] : "";
  },

  // Cloudflare strips Cache-Tag before the client; usually only the Host CDN
  // compatibility header survives.
  tags(index) {
    const raw = index.get("cache-tag") || index.get("millicache-edge-flags");
    if (!raw) return [];
    return raw.split(",").map(tag => tag.trim()).filter(Boolean);
  },

  tagSource(index) {
    if (index.has("millicache-edge-flags")) return "MilliCache-Edge-Flags";
    if (index.has("cache-tag")) return "Cache-Tag";
    return "";
  },

  cachedAt() {
    return null;
  }
};

const BUNNY = {
  id: "bunny",
  name: "bunny.net",

  detect(index) {
    if (index.has("cdn-cache") || index.has("cdn-pullzone") || index.has("cdn-requestid")) {
      return true;
    }
    return /bunnycdn/i.test(index.get("server") || "");
  },

  status(index) {
    return (index.get("cdn-cache") || "").trim().toLowerCase();
  },

  originFresh(status) {
    return originFreshness(status, BUNNY_FROM_ORIGIN, BUNNY_FROM_EDGE);
  },

  // Server is "BunnyCDN-<POP>-<node>", e.g. "BunnyCDN-FR1-1057".
  pop(index) {
    const server = index.get("server") || "";
    const match = server.match(/^BunnyCDN-([A-Z0-9]+)/i);
    if (match) return match[1];
    return index.get("cdn-edgestorageid") || "";
  },

  // One composite tag, every token wrapped in "~" (see Bunny::tag_value()).
  tags(index) {
    const raw = index.get("cdn-tag");
    if (!raw) return [];
    return raw.split("~").map(tag => tag.trim()).filter(Boolean);
  },

  tagSource(index) {
    return index.has("cdn-tag") ? "CDN-Tag" : "";
  },

  /**
   * When the edge stored this object. Authoritative here: bunny.net replays the
   * origin's Age verbatim, so Age says nothing about resident time.
   *
   * "MM/DD/YYYY HH:MM:SS" in UTC with no zone marker, which Date.parse() would
   * read as local time.
   */
  cachedAt(index) {
    const raw = (index.get("cdn-cachedat") || "").trim();
    if (!raw) return null;

    const parts = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2}):(\d{2})$/);
    if (parts) {
      const [, month, day, year, hour, minute, second] = parts.map(Number);
      return Date.UTC(year, month - 1, day, hour, minute, second);
    }

    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }
};

/** Any other cache in front of the origin: a host CDN, a reverse proxy. */
const GENERIC = {
  id: "generic",
  name: "CDN",

  detect(index) {
    return index.has("x-cache") || index.has("x-cache-status");
  },

  status(index) {
    const raw = (index.get("x-cache") || index.get("x-cache-status") || "").toLowerCase();
    if (/\bhit\b/.test(raw)) return "hit";
    if (/\bmiss\b/.test(raw)) return "miss";
    if (/\bstale\b/.test(raw)) return "stale";
    if (/\bbypass\b/.test(raw)) return "bypass";
    if (/\bexpired\b/.test(raw)) return "expired";
    return "";
  },

  originFresh(status) {
    return originFreshness(status, GENERIC_FROM_ORIGIN, GENERIC_FROM_EDGE);
  },

  pop() {
    return "";
  },

  tags() {
    return [];
  },

  tagSource() {
    return "";
  },

  cachedAt() {
    return null;
  }
};

// Specific providers before the generic sniffer.
export const PROVIDERS = [CLOUDFLARE, BUNNY, GENERIC];

/**
 * How long MilliCache asked the edge to keep this response.
 *
 * `s-maxage` only. RFC 9111 lets a shared cache fall back to `max-age`, but in
 * practice a CDN's own zone expiry overrides it, so it does not describe what
 * the edge will do: a bunny.net zone was observed serving a HIT it had held for
 * over an hour behind `max-age=0`, and a Cloudflare zone expiring an object
 * seconds after sending `max-age=14400`. Absent s-maxage the zone configuration
 * governs, which is not visible from here and must not be guessed at.
 *
 * Scans every Cache-Control line, since the Tagger appends rather than replaces.
 *
 * @param {object} index Header index.
 * @returns {number|null} Seconds, or null when the origin set no shared lifetime.
 */
function readSMaxAge(index) {
  for (const value of index.getAll("cache-control")) {
    const match = value.match(/s-maxage\s*=\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Whether the origin kept this response off the edge, as Tagger::mark_private()
 * does for variants and logged-in responses. Deliberate, not a failure.
 *
 * @param {object} index Header index.
 * @returns {boolean}
 */
function readPrivate(index) {
  return index.getAll("cache-control").some(value => /\bprivate\b/i.test(value));
}

// Accept-Encoding is on nearly every compressed response and Cloudflare adds it
// itself; it describes transfer encoding, not a variant.
const TRANSPORT_VARY = new Set(["accept-encoding"]);

/**
 * Vary keys that indicate a genuinely variant-keyed edge object.
 *
 * @param {object} index Header index.
 * @returns {string} Comma-separated keys, empty when only transport keys remain.
 */
function readVary(index) {
  return (index.get("vary") || "")
    .split(",")
    .map(key => key.trim())
    .filter(key => key && !TRANSPORT_VARY.has(key.toLowerCase()))
    .join(", ");
}

/**
 * Inspect a response for edge-cache signals.
 *
 * @param {object} index Header index from createHeaderIndex().
 * @returns {object} Edge observation. `detected` false means nothing sits in
 *   front of the origin, so `originFresh` is true by definition.
 */
export function detectEdge(index) {
  const provider = PROVIDERS.find(candidate => candidate.detect(index)) || null;

  const ageHeader = index.get("age");
  const age = ageHeader !== null && ageHeader !== "" && !Number.isNaN(Number(ageHeader))
    ? parseInt(ageHeader, 10)
    : null;

  const sMaxAge = readSMaxAge(index);

  if (!provider) {
    return {
      detected: false,
      providerId: "",
      providerName: "",
      status: "",
      originFresh: true,
      pop: "",
      age,
      sMaxAge,
      isPrivate: readPrivate(index),
      vary: readVary(index),
      tags: [],
      tagSource: "",
      cachedAt: null
    };
  }

  const status = provider.status(index);

  return {
    detected: true,
    providerId: provider.id,
    providerName: provider.name,
    status,
    originFresh: provider.originFresh(status),
    pop: provider.pop(index),
    age,
    sMaxAge,
    isPrivate: readPrivate(index),
    vary: readVary(index),
    tags: provider.tags(index).filter(isContentFlag),
    tagSource: provider.tagSource(index),
    cachedAt: provider.cachedAt(index)
  };
}
