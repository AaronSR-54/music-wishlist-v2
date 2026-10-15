# Proposal

## Why

The app can already be installed as a PWA, but once installed on Android the system chrome (status bar / browser UI) uses a fixed `theme_color` that does not match the app's active light/dark theme, so the installed app "no está del todo bien". At the same time there is no Android build or store pipeline, and we now want to publish the same web app to Google Play without losing the existing PWA install path.

## What Changes

- Make the installed app's `theme-color` **dynamic**: reflect the effective theme (light/dark/system) from `ThemeService` instead of a hardcoded value.
- Unify and correct theme colors across `manifest.json`, `src/index.html` and `public/meta-tags.html` (currently the manifest uses `#0e0e0e` while the metas use `#e5e0d8`/`#22201f`).
- Normalize manifest install metadata (add `id`, `scope`, `lang`, `dir`, `orientation`, `categories`, `display_override`) so install/TWA behavior is consistent.
- Add a Bubblewrap-based **TWA Android project** under `android/` that wraps the hosted PWA (applicationId, signing config, adaptive icon).
- Serve **Digital Asset Links** at `/.well-known/assetlinks.json` with the correct content type so the TWA opens without a URL bar.
- Add an `npm run android` script that produces a signed **AAB** plus R8 `mapping.txt`.
- Derive Android `versionCode`/`versionName` from `package.json` version to keep one source of truth.
- Add store assets (listing, release notes) and publish to a Play track using the existing `google-play-console` skill (`scripts/play.mjs`).
- Make **English the default display language** while still detecting the system/browser language and switching to Spanish when it is Spanish (fallback changes from Spanish to English).
- Keep the existing PWA install/offline experience working — no regression to the current service worker behavior.

## Capabilities

### New Capabilities

- `pwa-install-experience`: how the app looks and behaves when installed (PWA or TWA) — dynamic `theme-color`/status bar matching the active theme, consistent splash/app colors, and install metadata integrity.
- `android-play-distribution`: how the web app is packaged as an Android App Bundle (TWA), versioned, signed, and published to Google Play while the PWA install path remains available.
- `app-localization`: how the app chooses its display language — a saved user preference first, then system/browser language detection, defaulting to English when neither applies.

### Modified Capabilities

(none — the project has no existing specs yet)

## Impact

- **Web/manifest**: `public/manifest.json`, `src/index.html`, `public/meta-tags.html`, `src/app/core/theme/theme.service.ts`.
- **Localization**: `src/app/core/i18n/language.service.ts`, `src/index.html` (`<html lang>`).
- **New native project**: `android/` (Bubblewrap TWA: Gradle, signing, adaptive icons), `android/twa-manifest.json`.
- **Serving/hosting**: `vercel.json` (serve `.well-known/assetlinks.json` with `application/json`), static `.well-known/assetlinks.json`.
- **Build/release tooling**: `package.json` scripts (`android`, version sync), store assets under `store/`, usage of the `google-play-console` skill.
- **Docs**: `README.md` / `AGENTS.md` notes on the release flow.
- **Constraints**: keep the PWA installable (Chrome "Install app"), stay within the Vercel free plan (static files only, no new serverless endpoints), and respect the mandatory `package.json` version bump rules.
