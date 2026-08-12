/**
 * Response headers recorded verbatim from live zones, value formats included:
 * these catch assumptions only real traffic disproves.
 */

/**
 * bunny.net edge HIT in front of MilliCache, from https://www.new7wonders.com/
 * on 2026-08-12. Established two things:
 *
 *  - `cdn-cachedat` is UTC "MM/DD/YYYY HH:MM:SS" with no zone marker, so
 *    Date.parse() reads it as local time.
 *  - bunny.net does not increment `Age`: here it equals exactly
 *    cdn-cachedat - x-millicache-time, so `s-maxage - age` is not the edge's
 *    remaining freshness. Only the fill timestamp is a sound anchor.
 */
export const BUNNY_EDGE_HIT = {
  headers: {
    "date": "Wed, 12 Aug 2026 09:59:43 GMT",
    "content-type": "text/html; charset=UTF-8",
    "vary": "Accept-Encoding",
    "server": "BunnyCDN-DE1-1330",
    "cdn-pullzone": "497808",
    "cdn-requestcountrycode": "DE",
    "age": "124279",
    "cache-control": "s-maxage=345600",
    "x-millicache-key": "ddd234412e5b1430fb73675be2b3e0c4",
    "x-millicache-time": "Mon, 10 Aug 2026 05:55:07 GMT",
    "x-millicache-flags": "1:home 1:post:37 url:d935766d92008b90e6ad72cb8055ba2a",
    "x-millicache-expires": "2d 13h 28m 41s",
    "x-millicache-status": "hit",
    "cdn-tag": "~1:~1:post:37~1:home~url:d935766d92008b90e6ad72cb8055ba2a~",
    "cdn-proxyver": "1.58",
    "cdn-requestpullsuccess": "True",
    "cdn-requestpullcode": "200",
    "cdn-cachedat": "08/11/2026 16:26:26",
    "cdn-edgestorageid": "1328",
    "cdn-requestid": "abfccac4c859601f00a125a998d877f3",
    "cdn-cache": "HIT",
    "cdn-status": "200",
    "cdn-requesttime": "0"
  },
  observedAt: Date.parse("Wed, 12 Aug 2026 09:59:43 GMT"),
  storedAt: Date.UTC(2026, 7, 11, 16, 26, 26),
  entryWrittenAt: Date.parse("Mon, 10 Aug 2026 05:55:07 GMT")
};

/**
 * Cloudflare in Host CDN compatibility mode, from https://cf.yeyo.org/ on
 * 2026-08-12, serving a stale entry while it regenerates.
 *
 * The Tagger emits s-maxage only for responses it wants stored, so this one
 * carries the site's own max-age alone. A shared cache still honours max-age
 * (RFC 9111), so it is the lifetime the edge is really applying.
 */
export const CLOUDFLARE_STALE = {
  headers: {
    "date": "Wed, 12 Aug 2026 11:45:04 GMT",
    "content-type": "text/html; charset=UTF-8",
    "server": "cloudflare",
    "vary": "Accept-Encoding",
    "x-millicache-key": "253ae0227087e0ebbe8137e3ecc810d7",
    "x-millicache-time": "Wed, 12 Aug 2026 11:43:21 GMT",
    "x-millicache-flags": "url:231b11192cef3b4a63f5b5b642ca680f home post:9",
    "x-millicache-expires": "-0d 00h 01m 23s",
    "x-millicache-status": "stale",
    "millicache-edge-flags": "post:9,home,url:231b11192cef3b4a63f5b5b642ca680f",
    "age": "103",
    "cache-control": "max-age=14400",
    "cf-cache-status": "EXPIRED",
    "cf-ray": "a29f3b55bbad68fe-MUC"
  },
  observedAt: Date.parse("Wed, 12 Aug 2026 11:45:04 GMT")
};

/**
 * The same zone one request later, freshly regenerated, with the Tagger's
 * s-maxage present alongside the site's max-age.
 */
export const CLOUDFLARE_FRESH = {
  headers: {
    "date": "Wed, 12 Aug 2026 11:45:09 GMT",
    "content-type": "text/html; charset=UTF-8",
    "server": "cloudflare",
    "vary": "Accept-Encoding",
    "x-millicache-key": "253ae0227087e0ebbe8137e3ecc810d7",
    "x-millicache-time": "Wed, 12 Aug 2026 11:45:05 GMT",
    "x-millicache-flags": "url:231b11192cef3b4a63f5b5b642ca680f home post:9",
    "x-millicache-expires": "0d 00h 00m 16s",
    "x-millicache-status": "hit",
    "millicache-edge-flags": "post:9,home,url:231b11192cef3b4a63f5b5b642ca680f",
    "age": "4",
    "cache-control": "max-age=14400, s-maxage=20",
    "cf-cache-status": "EXPIRED",
    "cf-ray": "a29f3b6f7c0324d0-MUC"
  },
  observedAt: Date.parse("Wed, 12 Aug 2026 11:45:09 GMT")
};

/**
 * bunny.net edge HIT on a zone whose own expiry setting governs, from
 * https://www.meggle-group.com/qualitaet on 2026-08-12.
 *
 * No s-maxage: MilliCache is leaving edge expiry to the zone. The `max-age=0`
 * alongside is the site's browser directive, and the edge plainly ignores it,
 * serving a copy it had held for over an hour. Treating max-age as the edge
 * lifetime made the panel call this expired while the edge called it a HIT.
 */
export const BUNNY_ZONE_GOVERNED = {
  headers: {
    "date": "Wed, 12 Aug 2026 13:22:12 GMT",
    "content-type": "text/html; charset=UTF-8",
    "vary": "Accept-Encoding",
    "server": "BunnyCDN-DE1-1328",
    "cdn-pullzone": "1573383",
    "age": "14703",
    "cache-control": "public, max-age=0",
    "x-millicache-status": "hit",
    "x-millicache-key": "9279229e14da3481e572cedb61d18c75",
    "x-millicache-time": "Wed, 12 Aug 2026 08:03:35 GMT",
    "x-millicache-flags": "2:post:841 url:402630030786194565387116b9613da3",
    "x-millicache-expires": "0d 19h 54m 57s",
    "cdn-tag": "~2:~2:post:841~url:402630030786194565387116b9613da3~",
    "cdn-cachedat": "08/12/2026 12:08:38",
    "cdn-cache": "HIT",
    "cdn-status": "200"
  },
  observedAt: Date.parse("Wed, 12 Aug 2026 13:22:12 GMT"),
  storedAt: Date.UTC(2026, 7, 12, 12, 8, 38)
};

/**
 * @param {object} fixture One of the exports above.
 * @param {string} url Request URL.
 * @param {number} ttfb Time to first byte in ms.
 * @returns {object}
 */
export function toRequest(fixture, url = "https://www.new7wonders.com/", ttfb = 21) {
  return {
    request: { url },
    response: {
      status: 200,
      headers: Object.entries(fixture.headers).map(([name, value]) => ({ name, value }))
    },
    timings: { wait: ttfb }
  };
}
