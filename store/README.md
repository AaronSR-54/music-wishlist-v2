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

- **Contenido de la app / App content** (acceso, anuncios, clasificación, audiencia, Data safety, gobierno, finanzas, salud): solo por Play Console. Respuestas recomendadas en [`store/app-content.md`](app-content.md).
- **Política de privacidad / Privacy policy**: `https://music-wishlist-v2.vercel.app/privacy.html` (página estática, bilingüe, servida sin JS).
- **Eliminación de datos / Data deletion URL**: `https://music-wishlist-v2.vercel.app/delete-account.html` (página estática; borrado in-app en Perfil → *Eliminar cuenta*).
- **Acceso del revisor / App access**: cuenta de prueba de Google con sus pasos (ver `store/app-content.md`).
- **Categoría y datos de contacto**: Música y audio + web `https://music-wishlist-v2.vercel.app` (Play requiere además un email de desarrollador).
- **Ficha de Play Store**: se sube con el comando `listing` de la skill (ver *Ficha de Play Store* más abajo).

## 3. Digital Asset Links

`public/.well-known/assetlinks.json` lists the upload-key SHA-256 fingerprint so the TWA opens
without a URL bar. After deploying, verify it is served as `application/json`:

```bash
curl -I https://music-wishlist-v2.vercel.app/.well-known/assetlinks.json
```

If the URL bar still shows, the fingerprint or package name does not match the installed signer.

## Ficha de Play Store (listing)

El texto localizado y los gráficos viven versionados en `store/listing/` y se aplican con el
comando `listing` de la skill `google-play-console`:

```bash
PLAY=~/.config/opencode/skills/google-play-console/scripts/play.mjs

# 1) Monta el edit, valida y descarta (no commitea)
node "$PLAY" listing --dir store/listing --dry-run

# 2) Aplica la ficha de verdad (pasa a revisión de Google)
node "$PLAY" listing --dir store/listing
```

Layout:

- `store/listing/listing.en-US.json` — inglés (idioma por defecto de la ficha).
- `store/listing/listing.es-ES.json` — español.
- `store/listing/images/icon.png` — icono 512×512.
- `store/listing/images/feature-graphic.png` — gráfico destacado 1024×500.
- `store/listing/images/<lang>/*.png` — 2–8 capturas de teléfono **por idioma** (`en-US/`, `es-ES/`);
  si falta el directorio del idioma se usa el plano `images/*.png` como fallback.

El comando valida longitudes (título ≤ 30, descripción corta ≤ 80, larga ≤ 4000) y formatos
(PNG/JPEG, dimensiones) antes de tocar la API, y borra las capturas anteriores antes de subirlas
para que reejecutar sea idempotente. Cada idioma sube su propio set de capturas; el icono y el
gráfico destacado se suben solo al idioma por defecto (Play los trata como globales).

### Capturas

`npm run store:screenshots` captura las capturas de teléfono (1080×1920) recorriendo la app en
modo demo con Playwright. El idioma se fija con `STORE_CAPTURE_LANG` y se escribe en
`store/listing/images/<lang>/`:

```bash
npm start                                          # o deja que el script arranque el dev server
STORE_CAPTURE_LANG=en npm run store:screenshots    # → images/en-US/
STORE_CAPTURE_LANG=es npm run store:screenshots    # → images/es-ES/
```

Cubre lanzamientos, buscador, lista de deseos, artista, álbum y perfil. Sin marcos ni rótulos.
El modo demo fuerza el idioma de la app (`app-language`), así que cada set sale enteramente en su idioma.

**Fallback manual**: si Playwright/Chromium no está disponible, abre la app en modo demo
(`http://localhost:4200/?demo`) con una ventana de teléfono (360×640, zoom 3x) en cada sección y
guarda las capturas a mano en `store/listing/images/<lang>/`.

### Gráfico destacado

`npm run store:feature` regenera `store/listing/images/feature-graphic.png` (1024×500) a partir de
los assets reales de la marca: el `public/icon.svg` y el wordmark *Music Wishlist.* del header,
renderizados con la fuente display (Satoshi) en el navegador, y aplanados a PNG 24-bit sin alfa.

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
