# Changelog

## [1.0.10](https://github.com/MilliPress/millicache-firefox-ext/compare/v1.0.9...v1.0.10) (2025-12-09)


### Bug Fixes

* correct update_url to match repository name ([d561005](https://github.com/MilliPress/millicache-firefox-ext/commit/d5610051c0cae32941de5aeca7399e70dd499fb6))

## [1.0.9] - 2025-12-08

### Fixed
- Fixed TTFB savings calculation not displaying on HIT/STALE requests
- Use request URL instead of `x-millicache-key` header for MISS/HIT matching (header not present on MISS responses)

## [1.0.8] - 2025-12-04

### Changed
- Remove 5-minute expiration on MISS TTFB data for more reliable savings tracking
- Extend TTFB savings calculation to include "stale" cache status

### Added
- Dark mode icons (16px, 48px, 128px)
- Theme icons for light and dark modes in manifest

## [1.0.7] - 2025-11-24

### Added
- TTFB (Time To First Byte) display from HAR timings
- TTFB savings calculation comparing MISS vs HIT response times
- Savings display showing time saved and percentage improvement
- Development tooling: `package.json` with npm scripts for build/lint/publish
- AMO publishing support via `web-ext`

## [1.0.6] - 2025-11-24

### Added
- Support for "stale" cache status display
- Display of "reason" field from headers
- Filter out "url:" prefixed flags from display

## [1.0.5] - Initial tracked release

### Added
- DevTools panel for inspecting MilliCache headers
- Auto-expiring entries (highlight for 10s, remove after 20s)
- Reload separator with timestamp
- Display of cache key, time, flags, gzip status, and expiry
- HTTP status code badge
- Dark mode support
