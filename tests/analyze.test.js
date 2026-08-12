import test from "node:test";
import assert from "node:assert/strict";

import { analyze, createState, createHeaderIndex, readOriginHeaders, getTransitionLabel } from "../src/panel/analyze.js";
import { makeRequest, milliHeaders } from "./helpers.js";

const context = { lastNavigatedUrl: "https://example.com/" };

test("ignores favicon requests", () => {
  const request = makeRequest({ url: "https://example.com/favicon.ico" });
  assert.equal(analyze(request, createState(), context), null);
});

test("reports no-millicache when the status header is absent", () => {
  const observation = analyze(makeRequest(), createState(), context);
  assert.equal(observation.verdict, "no-millicache");
  assert.equal(observation.isMainDocument, true);
});

test("renders hit, miss and stale but not bypass on a subresource", () => {
  for (const status of ["hit", "miss", "stale"]) {
    const request = makeRequest({ headers: { "X-MilliCache-Status": status } });
    assert.equal(analyze(request, createState(), context).verdict, "render", status);
  }

  const subresource = makeRequest({
    url: "https://example.com/style.css",
    headers: { "X-MilliCache-Status": "bypass" }
  });
  assert.equal(analyze(subresource, createState(), context).verdict, "unsupported-status");

  const document = makeRequest({ headers: { "X-MilliCache-Status": "bypass" } });
  assert.equal(analyze(document, createState(), context).verdict, "render");
});

test("strips url: flags and reads the debug headers", () => {
  const observation = analyze(makeRequest({ headers: milliHeaders() }), createState(), context);

  assert.deepEqual(observation.origin.flags, ["2:post:123", "2:home"]);
  assert.equal(observation.origin.key, "abc123");
  assert.equal(observation.origin.gzip, true);
  assert.equal(observation.origin.hasDebugHeaders, true);
  assert.equal(observation.debugNotice, "hide");
});

test("nudges towards debug mode only on a bare non-miss status", () => {
  const state = createState();

  const hit = analyze(makeRequest({ headers: { "X-MilliCache-Status": "hit" } }), state, context);
  assert.equal(hit.debugNotice, "show");

  const miss = analyze(makeRequest({
    url: "https://example.com/other",
    headers: { "X-MilliCache-Status": "miss" }
  }), state, context);
  assert.equal(miss.debugNotice, null);
});

test("labels status transitions per URL", () => {
  const state = createState();

  const first = analyze(makeRequest({ headers: { "X-MilliCache-Status": "miss" } }), state, context);
  assert.equal(first.transitionLabel, null);

  const second = analyze(makeRequest({ headers: { "X-MilliCache-Status": "hit" } }), state, context);
  assert.equal(second.transitionLabel, "cached");

  assert.equal(getTransitionLabel("hit", "miss"), "cleared");
  assert.equal(getTransitionLabel("hit", "hit"), null);
});

test("computes savings from the previous miss on the same URL", () => {
  const state = createState();

  analyze(makeRequest({ ttfb: 400, headers: { "X-MilliCache-Status": "miss" } }), state, context);
  const hit = analyze(makeRequest({ ttfb: 40, headers: { "X-MilliCache-Status": "hit" } }), state, context);

  assert.deepEqual(hit.savings.origin, { timeSaved: 360, percentSaved: 90, missTtfb: 400, hitTtfb: 40 });
  assert.equal(hit.savings.edge, null);
});

test("indexes repeated headers instead of keeping only the first", () => {
  const index = createHeaderIndex([
    { name: "Cache-Control", value: "private" },
    { name: "Cache-Control", value: "s-maxage=600" }
  ]);

  assert.deepEqual(index.getAll("cache-control"), ["private", "s-maxage=600"]);
  assert.equal(index.get("cache-control"), "private");
});

test("reads origin headers case-insensitively", () => {
  const index = createHeaderIndex([{ name: "x-millicache-status", value: "HIT" }]);
  const origin = readOriginHeaders(index);

  assert.equal(origin.status, "HIT");
  assert.equal(origin.statusValue, "hit");
  assert.equal(origin.gzip, null);
});
