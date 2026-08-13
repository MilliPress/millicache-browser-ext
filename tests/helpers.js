/**
 * Builders for the DevTools HAR entries analyze() consumes.
 *
 * Real recorded responses belong in tests/fixtures/ once captured against live
 * Cloudflare and bunny.net zones; these builders cover the shape in the
 * meantime and keep the individual tests readable.
 */

/**
 * Build a request entry.
 *
 * @param {object} options url, status, ttfb, response headers and request headers.
 * @returns {object} DevTools HAR entry.
 */
export function makeRequest({ url = "https://example.com/", status = 200, ttfb = 100, headers = {}, requestHeaders = {} } = {}) {
  const list = [];

  Object.entries(headers).forEach(([name, value]) => {
    // An array means the header legitimately repeats (Cache-Control).
    (Array.isArray(value) ? value : [value]).forEach(single => {
      list.push({ name, value: String(single) });
    });
  });

  return {
    request: {
      url,
      headers: Object.entries(requestHeaders).map(([name, value]) => ({ name, value: String(value) }))
    },
    response: { status, headers: list },
    timings: { wait: ttfb }
  };
}

/** Headers of a MilliCache origin response with debug mode enabled. */
export function milliHeaders({ status = "hit", expires = "0d 00h 09m 31s", flags = "2:post:123 2:home url:abc" } = {}) {
  return {
    "X-MilliCache-Status": status,
    "X-MilliCache-Key": "abc123",
    "X-MilliCache-Time": "Mon, 11 Aug 2026 10:00:00 GMT",
    "X-MilliCache-Flags": flags,
    "X-MilliCache-Gzip": "true",
    "X-MilliCache-Expires": expires
  };
}
