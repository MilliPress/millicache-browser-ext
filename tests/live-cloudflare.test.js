// Assertions against responses recorded from a live Cloudflare zone.

import test from "node:test";
import assert from "node:assert/strict";

import { analyze, createState, createHeaderIndex, buildDiagnostics, resolveExpiry } from "../src/panel/analyze.js";
import { detectEdge } from "../src/panel/providers.js";
import { CLOUDFLARE_STALE, CLOUDFLARE_FRESH, toRequest } from "./fixtures.js";

const edgeOf = fixture => detectEdge(createHeaderIndex(
  Object.entries(fixture.headers).map(([name, value]) => ({ name, value }))
));

const analyzeOf = fixture => analyze(
  toRequest(fixture, "https://cf.yeyo.org/", 96),
  createState(),
  { lastNavigatedUrl: "https://cf.yeyo.org/" }
);

test("reads a live Cloudflare response", () => {
  const edge = edgeOf(CLOUDFLARE_FRESH);

  assert.equal(edge.providerId, "cloudflare");
  assert.equal(edge.status, "expired");
  assert.equal(edge.pop, "MUC");
  assert.equal(edge.vary, "");
});

test("treats EXPIRED as origin-served, and the headers prove it", () => {
  const observation = analyzeOf(CLOUDFLARE_FRESH);

  assert.equal(observation.servedBy, "origin");
  assert.equal(observation.origin.statusValue, "hit");

  // The entry was written 4s before the response: these headers were generated
  // for this request, not replayed from a stored copy.
  const written = Date.parse(CLOUDFLARE_FRESH.headers["x-millicache-time"]);
  assert.equal((CLOUDFLARE_FRESH.observedAt - written) / 1000, 4);
  assert.equal(edgeOf(CLOUDFLARE_FRESH).age, 4);
});

test("falls back to max-age when the Tagger sent no s-maxage", () => {
  // A stale serve carries only the site's own max-age; a shared cache honours
  // it, so it is the lifetime the edge is applying.
  const stale = edgeOf(CLOUDFLARE_STALE);
  assert.equal(stale.sMaxAge, 14400);
  assert.equal(stale.freshnessDirective, "max-age");

  // s-maxage wins wherever it is present, even alongside a longer max-age.
  const fresh = edgeOf(CLOUDFLARE_FRESH);
  assert.equal(fresh.sMaxAge, 20);
  assert.equal(fresh.freshnessDirective, "s-maxage");
});

test("does not warn about a missing lifetime when max-age supplies one", () => {
  const stale = edgeOf(CLOUDFLARE_STALE);
  const notes = buildDiagnostics({ reason: "", flags: [] }, stale, true);

  assert.equal(
    notes.some(note => /No s-maxage or max-age/.test(note.text)),
    false,
    "max-age governs the edge here, so the response is not unbounded"
  );
});

test("reads the tags Host CDN compatibility mode lets through", () => {
  // Cloudflare strips Cache-Tag; MilliCache-Edge-Flags survives, url: dropped.
  const edge = edgeOf(CLOUDFLARE_FRESH);

  assert.equal(edge.tagSource, "MilliCache-Edge-Flags");
  assert.deepEqual(edge.tags, ["post:9", "home"]);

  // Single site, so flags carry no site prefix.
  assert.deepEqual(analyzeOf(CLOUDFLARE_FRESH).origin.flags, ["home", "post:9"]);
});

test("reports an already-expired entry from a stale serve", () => {
  const observation = analyzeOf(CLOUDFLARE_STALE);

  assert.equal(observation.origin.statusValue, "stale");
  assert.equal(observation.effectiveStatus, "stale");

  // "-0d 00h 01m 23s": the entry lapsed 83s before the response was sent. The
  // origin answered, so the duration is relative to the observation instant.
  const expiry = resolveExpiry(observation.origin, observation.edge, CLOUDFLARE_STALE.observedAt);
  assert.equal(expiry.targetTime, CLOUDFLARE_STALE.observedAt - 83000);
  assert.ok(expiry.targetTime < CLOUDFLARE_STALE.observedAt);
});
