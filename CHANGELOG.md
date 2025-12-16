# Changelog

## [1.3.0](https://github.com/MilliPress/millicache-browser-ext/compare/v1.2.1...v1.3.0) (2025-12-16)


### Features

* add debug mode notice and site deactivation ([d942021](https://github.com/MilliPress/millicache-browser-ext/commit/d942021f766ffbc2342daa40e405d133477db950))
* add slide-up and flash animation when card moves to top ([48c448f](https://github.com/MilliPress/millicache-browser-ext/commit/48c448f90fab3a1d669a9d53958693befe86e5c9))
* improve panel UX with navigation markers and status transitions ([a0b1f6c](https://github.com/MilliPress/millicache-browser-ext/commit/a0b1f6cd53a3fed2fa5afc5ed0412f26cd9c1fbb))
* major UI redesign with flexbox layout and animations ([87755c1](https://github.com/MilliPress/millicache-browser-ext/commit/87755c1d3f1dd81e7a9061fc2da0cb912cbfd4dd))


### Bug Fixes

* add error recovery for card click navigation ([05f80c7](https://github.com/MilliPress/millicache-browser-ext/commit/05f80c77e1698272da5a748214e6e2fe3cbb3330))
* add failsafe timeout for navigation lock ([ba66c97](https://github.com/MilliPress/millicache-browser-ext/commit/ba66c974b3a357806b1626c567025a672a1455a5))
* allow multiple card clicks without blocking navigation ([dae41b6](https://github.com/MilliPress/millicache-browser-ext/commit/dae41b6b41c00f718bdef564d2a3dba01b22918f))
* bump version to 1.0.11 for release workflow testing ([7c3717a](https://github.com/MilliPress/millicache-browser-ext/commit/7c3717adbd7d0140a24e4523a345f4cd14e2d956))
* correct order of additional info display in panel ([89e4679](https://github.com/MilliPress/millicache-browser-ext/commit/89e4679f0b4acd59e957ec643a5212b1136136a9))
* correct update_url to match repository name ([e8a0efa](https://github.com/MilliPress/millicache-browser-ext/commit/e8a0efa639b918cca740bdc9d5fd9cea14628b8b))
* handle case where signed XPI already has correct filename ([524abbe](https://github.com/MilliPress/millicache-browser-ext/commit/524abbeb8810714887de59e1f19dff84760dd818))
* only show expired badge on hover when actually expired ([c494e44](https://github.com/MilliPress/millicache-browser-ext/commit/c494e445c7319e148543ae406824655ae23b65e9))
* remove slide-up animation, keep only flash for moved cards ([6739ebd](https://github.com/MilliPress/millicache-browser-ext/commit/6739ebdce4ba205044eaaa37e693bc53b2e2898c))
* show bypass status cards for HTML documents ([#6](https://github.com/MilliPress/millicache-browser-ext/issues/6)) ([fa40746](https://github.com/MilliPress/millicache-browser-ext/commit/fa40746ab6ddea1724fe17dafeb1abfa49ca9dd6))
* show expired badge on hover in compact mode, fix separator placement ([f865106](https://github.com/MilliPress/millicache-browser-ext/commit/f865106aae697e5597d96baf5f3310bd6ed8f0a9))
* simplify card reuse logic to always update existing cards ([522d407](https://github.com/MilliPress/millicache-browser-ext/commit/522d40756bf32fd99768c38606c1e822679e2282))
* simplify release-please config (remove package-name) ([476c2c5](https://github.com/MilliPress/millicache-browser-ext/commit/476c2c590263bfc760ccac0cb81dbe619a250293))
* sync countdowns and prevent rapid click navigation issues ([344b18a](https://github.com/MilliPress/millicache-browser-ext/commit/344b18a9be79b54659228640e583e46af6901d1c))
* update paths for src/ directory structure ([39bfaf8](https://github.com/MilliPress/millicache-browser-ext/commit/39bfaf84b244f6456d85d499ace34df0b9da6942))
* update status transition message from 'invalidated' to 'cleared' ([a97cb1d](https://github.com/MilliPress/millicache-browser-ext/commit/a97cb1d1570dbfe1277d974428cee2a5884a4f85))
* use correct icon for dark mode in DevTools panel ([f7c67a0](https://github.com/MilliPress/millicache-browser-ext/commit/f7c67a08fc01e9965417e3683c1d9b2d65fc4a64))
* use event delegation for card clicks ([876e805](https://github.com/MilliPress/millicache-browser-ext/commit/876e805c64a9e34b27076e370c77b21249b79eee))
* use separate build step before signing in release workflow ([514ed20](https://github.com/MilliPress/millicache-browser-ext/commit/514ed205c1436776b94fb15910296325f85b0a40))

## [1.2.1](https://github.com/MilliPress/millicache-browser-ext/compare/v1.2.0...v1.2.1) (2025-12-16)


### Bug Fixes

* show bypass status cards for HTML documents ([#6](https://github.com/MilliPress/millicache-browser-ext/issues/6)) ([fa40746](https://github.com/MilliPress/millicache-browser-ext/commit/fa40746ab6ddea1724fe17dafeb1abfa49ca9dd6))

## [1.2.0](https://github.com/MilliPress/millicache-firefox-ext/compare/v1.1.1...v1.2.0) (2025-12-11)


### Features

* add slide-up and flash animation when card moves to top ([48c448f](https://github.com/MilliPress/millicache-firefox-ext/commit/48c448f90fab3a1d669a9d53958693befe86e5c9))
* major UI redesign with flexbox layout and animations ([87755c1](https://github.com/MilliPress/millicache-firefox-ext/commit/87755c1d3f1dd81e7a9061fc2da0cb912cbfd4dd))


### Bug Fixes

* add error recovery for card click navigation ([05f80c7](https://github.com/MilliPress/millicache-firefox-ext/commit/05f80c77e1698272da5a748214e6e2fe3cbb3330))
* add failsafe timeout for navigation lock ([ba66c97](https://github.com/MilliPress/millicache-firefox-ext/commit/ba66c974b3a357806b1626c567025a672a1455a5))
* allow multiple card clicks without blocking navigation ([dae41b6](https://github.com/MilliPress/millicache-firefox-ext/commit/dae41b6b41c00f718bdef564d2a3dba01b22918f))
* only show expired badge on hover when actually expired ([c494e44](https://github.com/MilliPress/millicache-firefox-ext/commit/c494e445c7319e148543ae406824655ae23b65e9))
* remove slide-up animation, keep only flash for moved cards ([6739ebd](https://github.com/MilliPress/millicache-firefox-ext/commit/6739ebdce4ba205044eaaa37e693bc53b2e2898c))
* show expired badge on hover in compact mode, fix separator placement ([f865106](https://github.com/MilliPress/millicache-firefox-ext/commit/f865106aae697e5597d96baf5f3310bd6ed8f0a9))
* simplify card reuse logic to always update existing cards ([522d407](https://github.com/MilliPress/millicache-firefox-ext/commit/522d40756bf32fd99768c38606c1e822679e2282))
* sync countdowns and prevent rapid click navigation issues ([344b18a](https://github.com/MilliPress/millicache-firefox-ext/commit/344b18a9be79b54659228640e583e46af6901d1c))
* update status transition message from 'invalidated' to 'cleared' ([a97cb1d](https://github.com/MilliPress/millicache-firefox-ext/commit/a97cb1d1570dbfe1277d974428cee2a5884a4f85))
* use event delegation for card clicks ([876e805](https://github.com/MilliPress/millicache-firefox-ext/commit/876e805c64a9e34b27076e370c77b21249b79eee))

## [1.1.1](https://github.com/MilliPress/millicache-firefox-ext/compare/v1.1.0...v1.1.1) (2025-12-10)


### Bug Fixes

* correct order of additional info display in panel ([89e4679](https://github.com/MilliPress/millicache-firefox-ext/commit/89e4679f0b4acd59e957ec643a5212b1136136a9))
* simplify release-please config (remove package-name) ([476c2c5](https://github.com/MilliPress/millicache-firefox-ext/commit/476c2c590263bfc760ccac0cb81dbe619a250293))
* update paths for src/ directory structure ([39bfaf8](https://github.com/MilliPress/millicache-firefox-ext/commit/39bfaf84b244f6456d85d499ace34df0b9da6942))

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
