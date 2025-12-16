# Release Process

This document describes the release process for the MilliCache Header Inspector extension.

## Automated Release (Recommended)

The project uses **Release Please** for fully automated versioning, CHANGELOG generation, and publishing.

### How It Works

```
Push to main with Conventional Commits
            ↓
Release Please analyzes commits
            ↓
Creates/updates a Release PR
            ↓
Developer merges Release PR
            ↓
GitHub Release is created automatically
            ↓
Extension is built and signed (unlisted)
            ↓
Signed XPI uploaded to GitHub Release
            ↓
updates.json is updated and committed
            ↓
GitHub Pages serves updates.json
            ↓
Firefox detects update automatically
```

### Developer Workflow

1. **Make changes with Conventional Commits**:
   ```bash
   git commit -m "feat: add export functionality"
   git commit -m "fix: correct TTFB calculation"
   git push origin main
   ```

2. **Wait for Release PR**:
   - Release Please automatically creates a PR with version bump and CHANGELOG updates
   - Review the generated CHANGELOG

3. **Merge the Release PR**:
   - The extension is automatically built, signed, and published

### Conventional Commits

Release Please uses commit messages to determine version bumps:

| Commit Type | Example                       | Version Bump  |
|-------------|-------------------------------|---------------|
| `feat:`     | `feat: add dark mode toggle`  | Minor (1.x.0) |
| `fix:`      | `fix: correct header parsing` | Patch (1.0.x) |
| `docs:`     | `docs: update README`         | No release    |
| `chore:`    | `chore: update dependencies`  | No release    |
| `feat!:`    | `feat!: redesign panel UI`    | Major (x.0.0) |
| `fix!:`     | `fix!: change API response`   | Major (x.0.0) |

**Breaking Change**: Add `!` before the `:` to indicate a breaking change:
```bash
git commit -m "feat!: redesign panel UI with new layout"
```

---

## GitHub Setup

### Secrets Configuration

For automated publishing, configure these secrets in GitHub:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add two secrets:
   - `AMO_JWT_ISSUER`: Your AMO API Key (JWT Issuer)
   - `AMO_JWT_SECRET`: Your AMO API Secret

Get credentials from: https://addons.mozilla.org/developers/addon/api/key/

### GitHub Pages (for updates.json)

1. Go to **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main`
4. **Folder**: `/docs`
5. Click **Save**

The `updates.json` will be available at:
```
https://millipress.github.io/millicache-browser-ext/updates.json
```

---

## Unlisted vs Listed Extensions

This extension uses **unlisted** distribution:

| Aspect        | Listed              | Unlisted (this project)      |
|---------------|---------------------|------------------------------|
| AMO Page      | Public              | No public page               |
| Installation  | Via AMO Store       | Direct XPI download          |
| Updates       | AMO distributes     | Self-hosted `updates.json`   |
| Review        | Manual review       | Automatic signing            |
| Use Case      | Public extensions   | Internal/Private extensions  |

---

## Manual Release (Fallback)

Use this method if GitHub Actions are unavailable.

### Prerequisites

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up AMO API credentials**:
   ```bash
   cp .env.example .env
   # Edit .env and add your AMO credentials
   ```

### Release Steps

1. **Update version** in `manifest.json` and `package.json`

2. **Test locally**:
   ```bash
   npm start
   ```

3. **Lint and build**:
   ```bash
   npm run package
   ```

4. **Publish**:
   ```bash
   npm run publish:amo
   ```

5. **Manually update** `docs/updates.json` with the new version

---

## Local Development

```bash
# Install dependencies
npm install

# Run extension in Firefox for testing
npm start

# Lint the code
npm run lint

# Build ZIP package
npm run build

# Lint + Build
npm run package

# Publish to AMO (requires .env)
npm run publish:amo
```

---

## Troubleshooting

### GitHub Actions Failures

1. **Check Secrets**: Verify `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` are configured
2. **Check Logs**: Go to Actions tab → click failed run → view logs
3. **AMO Rate Limits**: Wait and retry if hitting API limits

### Updates Not Working

1. **Check GitHub Pages**: Verify `updates.json` is accessible at the configured URL
2. **Verify update_url**: Ensure `manifest.json` has the correct `update_url`
3. **Firefox Cache**: Firefox caches update checks; wait or restart Firefox

### Local Publishing Failures

1. **Verify `.env`**: Ensure credentials are correct
2. **Check Extension ID**: Must match `manifest.json` with AMO listing
3. **Manual Upload**: Use https://addons.mozilla.org/developers/ as fallback

---

## Support

- AMO Developer Hub: https://addons.mozilla.org/developers/
- Extension Workshop: https://extensionworkshop.com/
- Release Please: https://github.com/googleapis/release-please
- Firefox Update Manifest: https://extensionworkshop.com/documentation/manage/updating-your-extension/
