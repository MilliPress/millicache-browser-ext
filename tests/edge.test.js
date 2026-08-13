/**
 * The behaviour that only matters once MilliCache Pro puts a CDN in front of
 * the origin: MilliCache headers on an edge hit are a snapshot, so everything
 * derived from them has to be gated on who actually produced the response.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { analyze, createState, resolveExpiry, buildDiagnostics, parseDuration } from "../src/panel/analyze.js";
import { detectEdge } from "../src/panel/providers.js";
import { createHeaderIndex } from "../src/panel/analyze.js";
import { makeRequest, milliHeaders } from "./helpers.js";

const context = { lastNavigatedUrl: "https://example.com/" };

const cfHit = { "cf-ray": "8f2c-FRA", "cf-cache-status": "HIT" };
const cfMiss = { "cf-ray": "8f2c-FRA", "cf-cache-status": "MISS" };

const edgeFrom = headers => detectEdge(createHeaderIndex(
  Object.entries(headers).map(([name, value]) => ({ name, value: String(value) }))
));

test("parses MilliCache durations", () => {
  assert.equal(parseDuration("0d 00h 09m 31s"), 571);
  assert.equal(parseDuration("-0d 00h 01m 00s"), -60);
  assert.equal(parseDuration("600"), 600);
  assert.equal(parseDuration("forever"), null);
});

test("marks the origin status as a snapshot when the edge served it", () => {
  const request = makeRequest({ headers: { ...milliHeaders({ status: "miss" }), ...cfHit } });
  const observation = analyze(request, createState(), context);

  assert.equal(observation.origin.statusValue, "miss");
  assert.equal(observation.edge.originFresh, false);
  // The visitor got a fast edge hit, so that is what the card accent reflects.
  assert.equal(observation.effectiveStatus, "hit");
});

test("does not invent transitions across edge hits and misses", () => {
  const state = createState();

  // A real origin miss, then a real origin hit: that transition is genuine.
  analyze(makeRequest({ headers: { "X-MilliCache-Status": "miss", ...cfMiss } }), state, context);
  const cached = analyze(makeRequest({ headers: { "X-MilliCache-Status": "hit", ...cfMiss } }), state, context);
  assert.equal(cached.transitionLabel, "cached");

  // An edge hit replaying a stored MISS must not read as "cleared".
  const replayed = analyze(makeRequest({ headers: { "X-MilliCache-Status": "miss", ...cfHit } }), state, context);
  assert.equal(replayed.transitionLabel, null);

  // ...and it must not poison the baseline for the next real origin response.
  const next = analyze(makeRequest({ headers: { "X-MilliCache-Status": "hit", ...cfMiss } }), state, context);
  assert.equal(next.transitionLabel, null, "previous origin status was already hit");
});

test("sizes edge savings against the last response the origin produced", () => {
  const state = createState();

  const miss = analyze(makeRequest({ ttfb: 500, headers: { "X-MilliCache-Status": "miss", ...cfMiss } }), state, context);
  assert.equal(miss.savings.edge, null);

  const edgeHit = analyze(makeRequest({ ttfb: 20, headers: { "X-MilliCache-Status": "miss", ...cfHit } }), state, context);
  assert.deepEqual(edgeHit.savings.edge, { timeSaved: 480, percentSaved: 96, missTtfb: 500, hitTtfb: 20 });
  // The stored MISS must not be mistaken for a fresh origin miss baseline.
  assert.equal(edgeHit.savings.origin, null);
});

test("treats an expired edge object as an origin-served response", () => {
  const cfExpired = { "cf-ray": "8f2c-FRA", "cf-cache-status": "EXPIRED" };
  const request = makeRequest({ headers: { ...milliHeaders({ status: "hit" }), ...cfExpired } });
  const observation = analyze(request, createState(), context);

  // The edge refetched, so both layers are real and both are worth showing.
  assert.equal(observation.servedBy, "origin");
  assert.equal(observation.edge.originFresh, true);
  assert.equal(observation.effectiveStatus, "hit");
});

test("suppresses the debug-mode nudge behind an edge hit", () => {
  const bare = { "X-MilliCache-Status": "hit" };

  const direct = analyze(makeRequest({ headers: bare }), createState(), context);
  assert.equal(direct.debugNotice, "show");

  const replayed = analyze(makeRequest({ headers: { ...bare, ...cfHit } }), createState(), context);
  assert.equal(replayed.debugNotice, null, "the stored copy says nothing about current debug settings");
});

test("anchors the expiry countdown to an absolute instant on an edge hit", () => {
  const now = Date.parse("2026-08-11T10:05:00Z");
  const origin = {
    expires: "0d 00h 09m 31s",
    time: "Mon, 11 Aug 2026 10:00:00 GMT"
  };

  // Live from the origin: the duration is relative to now.
  const fresh = resolveExpiry(origin, { originFresh: true, sMaxAge: 600, cachedAt: null, age: null }, now);
  assert.equal(fresh.targetTime, now + 571000);
  assert.equal(fresh.approximate, false);

  // Replayed by the edge: entry update time + s-maxage, which cannot drift.
  const replayed = resolveExpiry(origin, { originFresh: false, sMaxAge: 600, cachedAt: null, age: 300 }, now);
  assert.equal(replayed.targetTime, Date.parse("2026-08-11T10:10:00Z"));
  assert.equal(replayed.approximate, false);

  // Without s-maxage, bunny's own fill timestamp is the next best anchor.
  const cachedAt = Date.parse("2026-08-11T10:01:00Z");
  const viaCachedAt = resolveExpiry(origin, { originFresh: false, sMaxAge: null, cachedAt, age: 240 }, now);
  assert.equal(viaCachedAt.targetTime, cachedAt + 571000);

  // Last resort: Age, which overstates residence, so flag it approximate.
  const viaAge = resolveExpiry({ ...origin, time: "" }, { originFresh: false, sMaxAge: null, cachedAt: null, age: 300 }, now);
  assert.equal(viaAge.targetTime, now + 571000 - 300000);
  assert.equal(viaAge.approximate, true);
});

test("flags Cloudflare serving HTML uncached", () => {
  const edge = edgeFrom({ "cf-ray": "8f2c-FRA", "cf-cache-status": "DYNAMIC" });
  const notes = buildDiagnostics({ reason: "", flags: [] }, edge, true);

  assert.ok(notes.some(note => note.level === "warn" && /not caching this page/.test(note.text)));
});

test("flags bunny.net storing pages untagged", () => {
  const edge = edgeFrom({ "server": "BunnyCDN-FR1-1", "cdn-cache": "HIT", "Cache-Control": "s-maxage=600" });
  const notes = buildDiagnostics({ reason: "", flags: [] }, edge, true);

  assert.ok(notes.some(note => note.level === "warn" && /untagged/.test(note.text)));
});

test("explains a private response instead of leaving it blank", () => {
  const edge = edgeFrom({ "cf-cache-status": "BYPASS", "Cache-Control": "private" });
  const notes = buildDiagnostics({ reason: "Logged-in user", flags: [] }, edge, true);

  assert.ok(notes.some(note => note.level === "info" && /Logged-in user/.test(note.text)));
});

test("does not call every compressed response a variant", () => {
  const routine = edgeFrom({ "cf-cache-status": "HIT", "Vary": "Accept-Encoding" });
  assert.equal(
    buildDiagnostics({ reason: "", flags: [] }, routine, true).some(note => /variant/.test(note.text)),
    false
  );

  const variant = edgeFrom({ "cf-cache-status": "HIT", "Vary": "Accept-Encoding, Accept" });
  assert.ok(
    buildDiagnostics({ reason: "", flags: [] }, variant, true)
      .some(note => /variant, keyed by Vary: Accept\./.test(note.text))
  );
});

test("reports an edge copy served past its s-maxage", () => {
  const edge = edgeFrom({ "cdn-cache": "STALE", "Cache-Control": "s-maxage=600", "Age": "900" });
  const notes = buildDiagnostics({ reason: "", flags: [] }, edge, true);

  assert.ok(notes.some(note => note.level === "warn" && /300s past its s-maxage/.test(note.text)));
});

test("only compares flags against edge tags when the origin wrote both", () => {
  const stale = edgeFrom({ "cf-cache-status": "HIT", "MilliCache-Edge-Flags": "2:home" });
  assert.equal(
    buildDiagnostics({ reason: "", flags: ["2:home", "2:post:123"] }, stale, true)
      .some(note => /Flags missing/.test(note.text)),
    false,
    "a snapshot's flags and a stored tag list are from different moments"
  );

  const live = edgeFrom({ "cf-cache-status": "MISS", "MilliCache-Edge-Flags": "2:home" });
  assert.ok(
    buildDiagnostics({ reason: "", flags: ["2:home", "2:post:123"] }, live, true)
      .some(note => /Flags missing from the edge tag: 2:post:123/.test(note.text))
  );
});

test("does not report a bypassed response as misconfigured", () => {
  // Nobody intends the edge to store a bypass, so a missing tag and a missing
  // lifetime are its expected shape rather than faults.
  const bypassed = edgeFrom({ "cdn-cache": "BYPASS", "server": "BunnyCDN-DE1-1" });
  const notes = buildDiagnostics({ reason: "", flags: [], statusValue: "bypass" }, bypassed, true);

  assert.equal(notes.some(n => /untagged/.test(n.text)), false);
  assert.equal(notes.some(n => /pull zone's own expiry/.test(n.text)), false);
});

test("still reports a storable response missing its tag and lifetime", () => {
  const storable = edgeFrom({ "cdn-cache": "MISS", "server": "BunnyCDN-DE1-1" });
  const notes = buildDiagnostics({ reason: "", flags: [], statusValue: "miss" }, storable, true);

  assert.ok(notes.some(n => /untagged/.test(n.text)));
  assert.ok(notes.some(n => /pull zone's own expiry/.test(n.text)));
});

test("treats bunny.net UPDATING as edge-served", () => {
  // Serving the stored copy while it refreshes in the background.
  assert.equal(edgeFrom({ "cdn-cache": "UPDATING", "server": "BunnyCDN-DE1-1" }).originFresh, false);
});
