# Release Process

This document describes the step-by-step process for releasing a new version of the MilliCache Header Inspector extension to Mozilla Add-ons (AMO).

## Prerequisites

### First Time Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up AMO API credentials**:
   - Visit https://addons.mozilla.org/developers/addon/api/key/
   - Log in with your Firefox Account
   - Click "Generate new credentials"
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and paste your credentials:
     ```
     AMO_JWT_ISSUER=user:12345:67
     AMO_JWT_SECRET=your-long-secret-hash-here
     ```
   - **IMPORTANT**: Never commit the `.env` file!
   - **Note**: The credentials are automatically loaded using `dotenv-cli`

## Release Checklist

### 1. Update Version

- [ ] Edit `manifest.json` and update the `version` field (e.g., `1.0.7`)
- [ ] Optionally update `package.json` version to match

### 2. Test Changes

- [ ] Test the extension locally:
  ```bash
  npm start
  ```
- [ ] Verify all features work as expected
- [ ] Check DevTools console for errors

### 3. Lint & Build

- [ ] Run linting to catch issues:
  ```bash
  npm run lint
  ```
- [ ] Fix any linting errors or warnings
- [ ] Build the extension package:
  ```bash
  npm run build
  ```
- [ ] The ZIP file will be created in `web-ext-artifacts/` directory

### 4. Publish to AMO

Choose one of the following methods:

#### Method A: Automated Publishing (Recommended)

- [ ] Ensure `.env` file is configured with AMO credentials
- [ ] Run the publish command:
  ```bash
  npm run publish:amo
  ```
- [ ] Wait for the signing and publishing process to complete
- [ ] Check the output for the signed XPI file location

#### Method B: Manual Upload

- [ ] Run the package command to lint and build:
  ```bash
  npm run package
  ```
- [ ] Go to https://addons.mozilla.org/developers/
- [ ] Navigate to your extension
- [ ] Click "Upload New Version"
- [ ] Upload the ZIP file from `web-ext-artifacts/`
- [ ] Fill in the release notes (see template below)
- [ ] Submit for review

### 5. Post-Release

- [ ] Verify the new version appears on AMO
- [ ] Test the auto-update in Firefox (may take a few hours)
- [ ] Update any external documentation if needed

## Release Notes Template

Use this template when uploading manually or for creating release announcements:

```
## Version [X.X.X]

### New Features
- [Feature description]

### Improvements
- [Improvement description]

### Bug Fixes
- [Bug fix description]

### Technical Changes
- [Technical detail for developers]
```

## Example Release Notes

```
## Version 1.0.7

### New Features
- Added TTFB (Time To First Byte) display for each request
- Added TTFB comparison between MISS and HIT requests to show cache performance improvements
- MISS request timings are tracked and compared with subsequent HIT requests (persists across page reloads)

### Improvements
- Savings display shows time saved and percentage improvement (e.g., "↓ 458ms faster (91% improvement)")
- Visual green highlight for savings rows
- Auto-cleanup of MISS timing data older than 5 minutes

### Bug Fixes
- None

### Technical Changes
- TTFB extracted from HAR request.timings.wait field
- Most recent MISS timing is always used for comparison
- Comparison shown on every HIT request when MISS data is available
```

```
## Version 1.0.6

### New Features
- Added support for millicache-reason header to show cache decision reasons
- Added support for "stale" status when cache is generated in background

### Improvements
- Flags starting with "url:" are now filtered out for cleaner display

### Bug Fixes
- None

### Technical Changes
- Updated status color indicator to show orange dot for stale responses
- Added millicache-reason header parsing and display
```

## Troubleshooting

### Linting Errors

If `npm run lint` shows errors:
- Check the error message for specific file and line number
- Common issues: missing permissions, invalid manifest fields
- Fix the issues and re-run `npm run lint`

### Publishing Failures

If `npm run publish:amo` fails:
- Verify your `.env` file has valid credentials
- Check that your AMO account has permissions for this extension
- Ensure the extension ID in `manifest.json` matches your AMO listing
- Try manual upload as fallback

### Build Issues

If `npm run build` fails:
- Check that all required files are present
- Verify `manifest.json` is valid JSON
- Ensure no syntax errors in JavaScript files

## Quick Commands Reference

```bash
# Install dependencies
npm install

# Run extension locally for testing
npm start

# Lint the code
npm run lint

# Build ZIP package
npm run build

# Lint + Build
npm run package

# Publish to AMO (automated)
npm run publish:amo
```

## Support

For AMO-specific issues:
- AMO Developer Hub: https://addons.mozilla.org/developers/
- Extension Workshop: https://extensionworkshop.com/
- AMO Support: https://discourse.mozilla.org/c/add-ons/35
