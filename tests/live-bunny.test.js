// Assertions against a response recorded from a live bunny.net zone.

import test from "node:test";
import assert from "node:assert/strict";

import { analyze, createState, createHeaderIndex, resolveExpiry, buildDiagnostics } from "../src/panel/analyze.js";
import { detectEdge } from "../src/panel/providers.js";
import { BUNNY_EDGE_HIT, toRequest } from "./fixtures.js";
import * as fixtures from "./fixtures.js";

const edge = () => detectEdge(createHeaderIndex(
  Object.entries(BUNNY_EDGE_HIT.headers).map(([name, value]) => ({ name, value }))
));

test("reads a live bunny.net edge hit", () => {
  const observed = edge();

  assert.equal(observed.providerId, "bunny");
  assert.equal(observed.status, "hit");
  assert.equal(observed.pop, "DE1", "parsed out of Server: BunnyCDN-DE1-1330");
  assert.equal(observed.originFresh, false);
  assert.equal(observed.sMaxAge, 345600);
  assert.equal(observed.age, 124279);
  assert.equal(observed.isPrivate, false);
});

test("parses cdn-cachedat as UTC, not local time", () => {
  // No zone marker, so Date.parse() would read it as local.
  assert.equal(edge().cachedAt, BUNNY_EDGE_HIT.storedAt);

  // Proof it is UTC: entry write time + Age lands exactly on the fill instant.
  assert.equal(
    BUNNY_EDGE_HIT.entryWrittenAt + (124279 * 1000),
    BUNNY_EDGE_HIT.storedAt
  );
});

test("does not treat bunny.net's Age as edge resident time", () => {
  const observed = edge();

  // Age is frozen at the fill; only the fill timestamp gives real freshness.
  const fromAge = observed.sMaxAge - observed.age;
  const fromFill = observed.sMaxAge - ((BUNNY_EDGE_HIT.observedAt - observed.cachedAt) / 1000);

  assert.equal(fromAge, 221321);
  assert.equal(fromFill, 282403);
  assert.ok(fromFill - fromAge > 60000, "the two differ by over 17 hours here");
});

test("drops the url: tag bunny.net carries in CDN-Tag", () => {
  assert.deepEqual(edge().tags, ["1:", "1:post:37", "1:home"]);
});

test("does not read Vary: Accept-Encoding as a variant", () => {
  assert.equal(edge().vary, "");
});

test("shows the edge alone and dates the entry from an absolute instant", () => {
  const observation = analyze(
    toRequest(BUNNY_EDGE_HIT),
    createState(),
    { lastNavigatedUrl: "https://www.new7wonders.com/" }
  );

  assert.equal(observation.verdict, "render");
  assert.equal(observation.servedBy, "edge", "the origin was not contacted");
  assert.equal(observation.effectiveStatus, "hit");
  assert.deepEqual(observation.origin.flags, ["1:home", "1:post:37"]);

  // Expires is relative to the fill, so it is re-anchored to an absolute
  // instant: entry time + s-maxage.
  const expiry = resolveExpiry(observation.origin, observation.edge, BUNNY_EDGE_HIT.observedAt);
  assert.equal(expiry.approximate, false);
  assert.equal(expiry.targetTime, BUNNY_EDGE_HIT.entryWrittenAt + (345600 * 1000));
  assert.equal(
    expiry.targetTime,
    BUNNY_EDGE_HIT.storedAt + (((2 * 86400) + (13 * 3600) + (28 * 60) + 41) * 1000),
    "matches what the header claimed at fill time"
  );
});

test("does not call an edge HIT expired when the zone governs expiry", () => {
  const { BUNNY_ZONE_GOVERNED } = fixtures;
  const observed = detectEdge(createHeaderIndex(
    Object.entries(BUNNY_ZONE_GOVERNED.headers).map(([name, value]) => ({ name, value }))
  ));

  // max-age=0 is the site's browser directive. The edge ignores it: this copy
  // had been held for over an hour and was still served as a HIT.
  assert.equal(observed.status, "hit");
  assert.equal(observed.sMaxAge, null, "no s-maxage, so no lifetime can be claimed");
  assert.equal((BUNNY_ZONE_GOVERNED.observedAt - BUNNY_ZONE_GOVERNED.storedAt) / 1000, 4414);

  // With no lifetime there is nothing to be overdue against, so the card cannot
  // contradict the edge by flipping its headline to EXPIRED.
  const notes = buildDiagnostics({ reason: "", flags: [] }, observed, true);
  assert.equal(notes.some(n => /past its s-maxage/.test(n.text)), false);
  assert.ok(notes.some(n => n.level === "info" && /pull zone's own expiry/.test(n.text)));
});
