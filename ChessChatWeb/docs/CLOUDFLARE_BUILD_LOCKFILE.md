# Cloudflare Build Lockfile Requirements

## Problem Statement

Cloudflare's build system uses `npm ci` for dependency installation, which requires an existing `package-lock.json` file. Without this file, the build fails with:

```
npm error The npm ci command can only install with an existing package-lock.json ...
```

## Solution

This repository includes a committed `package-lock.json` at the root level to ensure deterministic, reproducible builds on Cloudflare.

## Why `npm ci` Instead of `npm install`?

Cloudflare prefers `npm ci` because it:
- Ensures exact dependency versions from the lockfile
- Provides deterministic builds across all environments
- Is faster than `npm install` in CI/CD pipelines
- Fails if package.json and package-lock.json are out of sync

## Lockfile Management

### Current Setup
- **Lockfile version**: 3 (npm v7+)
- **Location**: `package-lock.json` at repository root
- **Compatibility**: Works with Cloudflare's build system

### Regenerating the Lockfile

If you need to regenerate `package-lock.json` (e.g., after changing dependencies):

```bash
# Option 1: Update lockfile without reinstalling dependencies
npm install --package-lock-only

# Option 2: If you encounter peer dependency issues
npm install --package-lock-only --legacy-peer-deps
```

### Verifying the Lockfile

To verify the lockfile works correctly:

```bash
# Test that npm ci works
npm ci

# Test the build
npm run build
```

## Important Warnings

⚠️ **DO NOT delete `package-lock.json`** - Cloudflare builds will fail without it

⚠️ **DO commit `package-lock.json`** - It must be in version control

⚠️ **DO keep it in sync** - Run `npm install` when updating `package.json`

## Cloudflare Build Configuration

The Cloudflare build process automatically runs:

1. `npm ci` - Installs dependencies from lockfile
2. `npm run build` - Builds the application

No special configuration is needed in Cloudflare settings if the lockfile is present.

## Troubleshooting

### Build still failing after adding lockfile?

1. **Verify lockfile is committed**:
   ```bash
   git status package-lock.json
   # Should show as committed, not untracked
   ```

2. **Check lockfile version**:
   ```bash
   grep lockfileVersion package-lock.json
   # Should show: "lockfileVersion": 3 (or 2, or 1)
   ```

3. **Test locally**:
   ```bash
   rm -rf node_modules
   npm ci
   npm run build
   ```

4. **Peer dependency warnings**: These are usually non-blocking. If they cause issues, consider adding `.npmrc`:
   ```
   legacy-peer-deps=true
   ```

### Lockfile out of sync with package.json?

If you see errors about mismatched versions:

```bash
# Regenerate the lockfile
rm package-lock.json
npm install
git add package-lock.json
git commit -m "chore: regenerate package-lock.json"
```

## References

- [npm ci documentation](https://docs.npmjs.com/cli/v9/commands/npm-ci)
- [Cloudflare Pages Build Configuration](https://developers.cloudflare.com/pages/platform/build-configuration/)
- [About package-lock.json](https://docs.npmjs.com/cli/v9/configuring-npm/package-lock-json)
