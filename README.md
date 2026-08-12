# MilliCache Header Inspector

A Firefox DevTools extension that displays MilliCache HTTP response headers in a dedicated panel.

## What it does

This extension adds a "MilliCache" tab to Firefox DevTools that shows cache status information for sites using [MilliCache](https://github.com/millipress/millicache) - a high-performance caching solution for WordPress.

The panel displays:
- Cache status (HIT, MISS, STALE, BYPASS)
- Cache key and timing information
- TTFB (Time To First Byte) measurements
- TTFB savings comparison between cache hits and misses
- Compression status and expiration times

## CDN edge caching

With [MilliCache Pro](https://millipress.com)'s Edge Cache module, a CDN sits in front of the origin and pages are served from bunny.net or Cloudflare. The panel understands both layers.

This matters because a CDN stores whatever it saw on the wire, MilliCache's own headers included. On an edge hit those headers are a photograph of the one origin request that filled the object — which is why a page served from the edge can carry `X-MilliCache-Status: miss` while the visitor is getting a fast hit.

The panel resolves that by asking who actually produced the response:

- **The edge served it.** The edge is the whole answer: which provider, which PoP, and how long its copy stays fresh. The origin's headers are a replay of the fill request, so they are not shown — there is nothing there anyone can act on.
- **The request reached the origin.** Both layers are shown, and the MilliCache values are live: status, cache key, flags, expiry, compression.

Supported providers are detected automatically from the response:

| Provider | Detected via | Tags read from |
|---|---|---|
| **Cloudflare** | `cf-cache-status`, `cf-ray` | `Cache-Tag`, or `MilliCache-Edge-Flags` in Host CDN compatibility mode |
| **bunny.net** | `cdn-cache`, `Server: BunnyCDN-*` | `CDN-Tag` |
| Any other cache | `x-cache` | — |

### Diagnostics

Several Edge Cache misconfigurations are invisible in the Network panel because nothing errors — pages are simply never cached, or never purgeable. The panel calls them out on the card:

- **Cloudflare returning `DYNAMIC`** on a page, meaning no Cache Rule makes the HTML eligible and Edge Cache is doing nothing.
- **Missing `CDN-Tag`** on bunny.net, so pages are stored untagged and flag purges match nothing.
- **Flags missing from the edge tag**, marked on the individual flag pill — those flags cannot clear the page at the edge.
- **No `s-maxage`** on the response, so the edge TTL is governed by the zone rather than by MilliCache.
- **An edge copy past its `s-maxage`**, being served stale.
- **`Cache-Control: private`**, which is deliberate rather than broken: variants and logged-in responses are kept off the edge by design.

Expiry countdowns are anchored to an absolute instant rather than to the moment the header arrived, so a page replayed from the edge does not show a countdown that started when the object was filled.

## Installation

Download the latest signed XPI from [GitHub Releases](https://github.com/MilliPress/millicache-firefox-ext/releases/latest) and open it in Firefox to install.

Updates are delivered automatically via Firefox's extension update system.

## Usage

1. Open Firefox DevTools (F12)
2. Navigate to the "MilliCache" tab
3. Browse a site that uses MilliCache to see header information

Click a card's header to expand or collapse its detail, click the URL to load that page in the inspected tab, and click any flag pill to copy it.

**Note:** For detailed debugging information, enable debug mode in your MilliCache settings. Without debug mode, only the cache status header is returned.

## Development

```bash
npm install
npm start      # run the extension in Firefox
npm test       # unit tests for the header analysis
npm run lint   # validate the extension
npm run build  # build a distributable package
```

### Layout

Header interpretation is kept separate from rendering, so the analysis can be tested without a browser:

| File | Responsibility |
|---|---|
| `src/panel/providers.js` | CDN detection per provider, and whether the origin produced a given response |
| `src/panel/analyze.js` | Pure `analyze()` turning a request into a normalized observation. No DOM, no timers |
| `src/panel/panel.js` | Rendering, animation and panel state |

`tests/` exercises `analyze.js` and `providers.js` directly with synthetic responses (`node --test`).

### Previewing design changes

`design/panel-preview.html` renders the real `panel.js` and `panel.css` against synthetic responses, with the DevTools APIs stubbed. It covers an edge hit, an uncached Cloudflare page, a bypass, broken tagging and a site with no CDN, and includes a theme toggle that drives the same `onThemeChanged` path the extension uses.

ES modules need a real origin, so serve it rather than opening the file directly:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/design/panel-preview.html
```

## Links

- [MilliCache Repository](https://github.com/millipress/millicache)
- [MilliPress Website](https://millipress.com)

## License

MIT
