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

test("reads only s-maxage as the edge lifetime", () => {
  // The stale serve carries max-age=14400, yet the request 5s later was still
  // EXPIRED rather than a four-hour HIT: Cloudflare was not honouring it.
  const stale = edgeOf(CLOUDFLARE_STALE);
  assert.equal(stale.sMaxAge, null, "max-age is the browser directive, not the edge's");

  const fresh = edgeOf(CLOUDFLARE_FRESH);
  assert.equal(fresh.sMaxAge, 20, "s-maxage wins, even beside a much longer max-age");
});

test("notes, without alarm, that the zone governs expiry", () => {
  const notes = buildDiagnostics({ reason: "", flags: [] }, edgeOf(CLOUDFLARE_STALE), true);
  const note = notes.find(n => /pull zone's own expiry/.test(n.text));

  // Emitting no TTL header is a supported setup, not a misconfiguration.
  assert.ok(note);
  assert.equal(note.level, "info");
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
