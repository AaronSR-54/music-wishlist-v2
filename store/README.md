# Google Play — release guide

Android app: TWA wrapping `https://music-wishlist-v2.vercel.app`.
Package: `com.musicwishlist.app`. Tooling: `@bubblewrap/cli` + Google Play Developer API.

## 1. Build the bundle

```bash
npm run android
```

- Syncs `appVersionCode`/`appVersionName` in `android/twa-manifest.json` from `package.json`
  (`versionCode = major*10000 + minor*100 + patch`).
- Regenerates the Android project and builds a signed AAB + mapping.

Outputs:

- `android/app-release-bundle.aab` (upload this)
- `android/app/build/outputs/mapping/release/mapping.txt` (deobfuscation)

The upload keystore lives **outside the repo** at `~/.config/music-wishlist/android.keystore`
(alias `android`), password in `~/.config/music-wishlist/keystore.password` (chmod 600).
Never commit it; losing it means the app can never be updated.

## 2. Prerequisites (manual, in Play Console)

The Play API **cannot create the app** — do this once in
[Play Console](https://play.google.com/console) → **Create app**, using the package
`com.musicwishlist.app` (the package is immutable after the first upload) and
**English as the default listing language** (add a Spanish store listing as an
additional language if desired).

### App display language

The app is not fixed to the store language: `LanguageService` prefers a saved user
preference, otherwise detects the system/browser language, and **defaults to English**
when it is not Spanish. So a device set to Spanish shows Spanish automatically; every
other locale shows English.

Also required before publishing (not available via the API):

- **Seguridad de los datos / Data safety**: Política y programa → Contenido de la app → Seguridad de los datos.
- **Clasificación de contenido / Content rating**: same section.
- **Política de privacidad / Privacy policy**: public URL required.
- **Ficha de Play Store**: descripción, capturas, icono (usa `android/store_icon.png`), gráfico destacado.

## 3. Digital Asset Links

`public/.well-known/assetlinks.json` lists the upload-key SHA-256 fingerprint so the TWA opens
without a URL bar. After deploying, verify it is served as `application/json`:

```bash
curl -I https://music-wishlist-v2.vercel.app/.well-known/assetlinks.json
```

If the URL bar still shows, the fingerprint or package name does not match the installed signer.

## 4. Publish with the Play CLI

```bash
PLAY=~/.config/opencode/skills/google-play-console/scripts/play.mjs

# Read-only: releases per track + uploaded AABs
node "$PLAY" status --package com.musicwishlist.app

# Upload to internal (dry-run first, then for real)
node "$PLAY" upload \
  --bundle android/app-release-bundle.aab \
  --track internal \
  --notes store/release-notes.md \
  --name "0.16.1" \
  --mapping android/app/build/outputs/mapping/release/mapping.txt \
  --dry-run

# Reuse an already-uploaded AAB on another track
node "$PLAY" upload --version-code 1601 --track alpha --notes store/release-notes.md
```

## 5. Testing requirement and promotion path

- **Internal** (`internal`): fastest, up to 100 testers, for smoke tests.
- **Closed** (`alpha`): required before production for **personal accounts created after
  2023-11-13** — a closed test with **12 testers for 14 continuous days**. The API only accepts
  Google Groups as testers; individual email lists are managed by hand in Play Console.
- **Open/Production** (`production`): after the closed test requirement is met. Use
  `--status inProgress --rollout 0.1` for a staged rollout.

A committed release goes into Google review (first review can take up to 7 days).
