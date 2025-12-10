# Changelog

## [1.1.0](https://github.com/MilliPress/millicache-firefox-ext/compare/v1.0.12...v1.1.0) (2025-12-10)


### Features

* add debug mode notice and site deactivation ([d942021](https://github.com/MilliPress/millicache-firefox-ext/commit/d942021f766ffbc2342daa40e405d133477db950))
* improve panel UX with navigation markers and status transitions ([a0b1f6c](https://github.com/MilliPress/millicache-firefox-ext/commit/a0b1f6cd53a3fed2fa5afc5ed0412f26cd9c1fbb))


### Bug Fixes

* bump version to 1.0.11 for release workflow testing ([7c3717a](https://github.com/MilliPress/millicache-firefox-ext/commit/7c3717adbd7d0140a24e4523a345f4cd14e2d956))
* correct update_url to match repository name ([e8a0efa](https://github.com/MilliPress/millicache-firefox-ext/commit/e8a0efa639b918cca740bdc9d5fd9cea14628b8b))
* handle case where signed XPI already has correct filename ([524abbe](https://github.com/MilliPress/millicache-firefox-ext/commit/524abbeb8810714887de59e1f19dff84760dd818))
* use correct icon for dark mode in DevTools panel ([f7c67a0](https://github.com/MilliPress/millicache-firefox-ext/commit/f7c67a08fc01e9965417e3683c1d9b2d65fc4a64))
* use separate build step before signing in release workflow ([514ed20](https://github.com/MilliPress/millicache-firefox-ext/commit/514ed205c1436776b94fb15910296325f85b0a40))

## [1.0.12](https://github.com/MilliPress/millicache-firefox-ext/compare/v1.0.11...v1.0.12) (2025-12-10)


### Bug Fixes

* fix release workflow to use separate build/sign steps ([601f41c](https://github.com/MilliPress/millicache-firefox-ext/commit/601f41c))
* handle case where signed XPI already has correct filename ([122cbc7](https://github.com/MilliPress/millicache-firefox-ext/commit/122cbc7))


### Features

* add workflow_dispatch trigger for manual release testing


## [1.0.11](https://github.com/MilliPress/millicache-firefox-ext/compare/v1.0.10...v1.0.11) (2025-12-10)


### Bug Fixes

* bump version to 1.0.11 for release workflow testing


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
