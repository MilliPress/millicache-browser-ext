import test from "node:test";
import assert from "node:assert/strict";

import { createHeaderIndex } from "../src/panel/analyze.js";
import { detectEdge } from "../src/panel/providers.js";

const edgeOf = headers => detectEdge(createHeaderIndex(
  Object.entries(headers).flatMap(([name, value]) =>
    (Array.isArray(value) ? value : [value]).map(single => ({ name, value: String(single) })))
));

test("treats a response with no CDN in front as origin-fresh", () => {
  const edge = edgeOf({ "X-MilliCache-Status": "hit" });

  assert.equal(edge.detected, false);
  assert.equal(edge.originFresh, true);
});

test("reads Cloudflare status, PoP and origin freshness", () => {
  const hit = edgeOf({ "cf-ray": "8f2c1a9b0d3e4f56-FRA", "cf-cache-status": "HIT" });
  assert.equal(hit.providerId, "cloudflare");
  assert.equal(hit.status, "hit");
  assert.equal(hit.pop, "FRA");
  // The edge served stored bytes, so the MilliCache headers are a snapshot.
  assert.equal(hit.originFresh, false);

  const miss = edgeOf({ "cf-ray": "8f2c1a9b0d3e4f56-FRA", "cf-cache-status": "MISS" });
  assert.equal(miss.originFresh, true);

  // DYNAMIC means no Cache Rule made the HTML eligible; the origin answered.
  const dynamic = edgeOf({ "cf-ray": "8f2c-AMS", "cf-cache-status": "DYNAMIC" });
  assert.equal(dynamic.originFresh, true);

  // An expired edge object is refetched from the origin. MilliCache strips
  // If-None-Match/If-Modified-Since (Engine/Request/Cleaner), so it can never
  // answer with a 304 and the response always carries live headers.
  const expired = edgeOf({ "cf-ray": "8f2c-AMS", "cf-cache-status": "EXPIRED" });
  assert.equal(expired.originFresh, true);

  // A 304 answer, which MilliCache cannot produce; if seen, the stored copy
  // is what reached the browser.
  const revalidated = edgeOf({ "cf-ray": "8f2c-AMS", "cf-cache-status": "REVALIDATED" });
  assert.equal(revalidated.originFresh, false);

  // Only an unrecognised status leaves the question open.
  assert.equal(edgeOf({ "cf-ray": "8f2c-AMS", "cf-cache-status": "WHAT" }).originFresh, null);
});

test("shows both layers when an expired edge object is refetched", () => {
  const expired = edgeOf({ "cdn-cache": "EXPIRED", "server": "BunnyCDN-FR1-1" });
  assert.equal(expired.originFresh, true, "bunny.net refetches an expired object the same way");
});

test("reads the Cloudflare host-CDN compatibility tags", () => {
  const edge = edgeOf({
    "cf-cache-status": "HIT",
    "MilliCache-Edge-Flags": "2:,2:post:123,2:home"
  });

  assert.deepEqual(edge.tags, ["2:", "2:post:123", "2:home"]);
  assert.equal(edge.tagSource, "MilliCache-Edge-Flags");
});

test("drops url: tags from the edge tag list, as it does for origin flags", () => {
  // The Tagger sends MilliCache's canonical flags on, url: hashes included.
  const bunny = edgeOf({ "cdn-cache": "HIT", "cdn-tag": "~2:~url:9d2f1a~2:home~" });
  assert.deepEqual(bunny.tags, ["2:", "2:home"]);

  const cloudflare = edgeOf({ "cf-cache-status": "HIT", "MilliCache-Edge-Flags": "2:,url:9d2f1a,2:home" });
  assert.deepEqual(cloudflare.tags, ["2:", "2:home"]);
});

test("splits the bunny.net composite CDN-Tag on its separator", () => {
  const edge = edgeOf({
    "server": "BunnyCDN-FR1-1057",
    "cdn-cache": "HIT",
    "cdn-tag": "~2:~2:post:123~2:home~",
    "cdn-cachedat": "Mon, 11 Aug 2026 10:00:00 GMT"
  });

  assert.equal(edge.providerId, "bunny");
  assert.equal(edge.pop, "FR1");
  assert.deepEqual(edge.tags, ["2:", "2:post:123", "2:home"]);
  assert.equal(edge.originFresh, false);
  assert.equal(edge.cachedAt, Date.parse("Mon, 11 Aug 2026 10:00:00 GMT"));
});

test("finds s-maxage and private across repeated Cache-Control lines", () => {
  const edge = edgeOf({ "Cache-Control": ["public", "s-maxage=600"] });
  assert.equal(edge.sMaxAge, 600);
  assert.equal(edge.isPrivate, false);

  const variant = edgeOf({ "Cache-Control": ["s-maxage=600", "private"] });
  assert.equal(variant.isPrivate, true);
});

test("ignores Accept-Encoding when looking for a variant Vary", () => {
  // Present on virtually every compressed response, and added by Cloudflare
  // itself, so it must not read as a MilliCache variant.
  assert.equal(edgeOf({ "cf-cache-status": "HIT", "Vary": "Accept-Encoding" }).vary, "");
  assert.equal(edgeOf({ "cf-cache-status": "HIT", "Vary": "accept-encoding" }).vary, "");
  assert.equal(edgeOf({ "cf-cache-status": "HIT" }).vary, "");

  // A real variant opt-in survives, with the transport key stripped out.
  assert.equal(edgeOf({ "cf-cache-status": "HIT", "Vary": "Accept-Encoding, Accept" }).vary, "Accept");
});

test("falls back to a generic CDN when x-cache is present", () => {
  const edge = edgeOf({ "x-cache": "HIT from cache-fra-1" });

  assert.equal(edge.providerId, "generic");
  assert.equal(edge.status, "hit");
  assert.equal(edge.originFresh, false);
});
