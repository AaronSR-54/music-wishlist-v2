# Google Play — release guide

Android app: Capacitor wrapper over the bundled Angular build (no TWA, no Digital Asset Links).
Package: `com.musicwishlist.app`. Tooling: `@capacitor/cli` + Google Play Developer API.

## 1. Build the bundle

```bash
npm run android
```

- Syncs `versionCode`/`versionName` in `android/app/build.gradle` from `package.json`
  (`versionCode = major*10000 + minor*100 + patch`).
- Builds the Angular app, copies it into the Capacitor project (`cap sync android`) and builds a
  signed AAB + R8 mapping.

Outputs:

- `android/app/build/outputs/bundle/release/app-release.aab` (upload this)
- `android/app/build/outputs/mapping/release/mapping.txt` (deobfuscation)

The upload keystore lives **outside the repo** at `~/.config/music-wishlist/android.keystore`
(alias `android`), password in `~/.config/music-wishlist/keystore.password` (chmod 600).
Never commit it; losing it means the app can never be updated.

### Native branding (launcher icon + splash)

The Android launcher icon and splash screen are generated from the brand mark in `public/icon.svg`
by `@capacitor/assets`, driven by the source images in `resources/`:

```bash
npm run android:assets
```

- Composes `resources/icon-only.png` (mark on `#22201f`), `resources/icon-foreground.png`
  (transparent mark), `resources/icon-background.png` (`#22201f`) and `resources/splash.png`
  (mark centred on `#22201f`) from `public/icon.svg`.
- Regenerates every `android/app/src/main/res/mipmap-*` launcher variant and `drawable*/splash.png`
  density, so the icon and splash only ever need editing through `public/icon.svg`.

Run it after changing the brand mark, before `npm run android`.

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
- **Acceso del revisor / App access**: login demo `demo` / `1234` en la pantalla de inicio de sesión (ver `store/app-content.md`).
- **Categoría y datos de contacto**: Música y audio + web `https://music-wishlist-v2.vercel.app` (Play requiere además un email de desarrollador).
- **Ficha de Play Store**: se sube con el comando `listing` de la skill (ver *Ficha de Play Store* más abajo).

## 3. Firebase configuration (native auth + push)

The Capacitor app uses **native Google Sign-In** and **Firebase Cloud Messaging**. Both need the
Android app registered in the Firebase project (the same project as the web app):

1. Firebase Console → project settings → add an **Android app** with package
   `com.musicwishlist.app`.
2. Add the **SHA-1** of the signing certificate (Play Console → *Release → Setup → App integrity* →
   app signing key certificate; add the upload-key SHA-1 as well for local builds) and download
   **`google-services.json`** into `android/app/google-services.json` (never committed).
3. Enable **Cloud Messaging**. The server sends native push through FCM HTTP v1 using the
   `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` service account (scope `cloud-platform`).

This is already done for `music-whitelist` (Android app
`1:513306310710:android:1e937ad3f19a57b51a0097`, FCM enabled, upload-key SHA-1 registered). With the
Firebase CLI logged in it can be reproduced/redone from scratch:

```bash
npx firebase-tools apps:create ANDROID "Music Wishlist" \
  --package-name com.musicwishlist.app --project music-whitelist
npx firebase-tools apps:sdkconfig ANDROID <appId> \
  --out android/app/google-services.json --project music-whitelist
# SHA-1 (upload key) via the Firebase Management API:
#   POST https://firebase.googleapis.com/v1beta1/projects/music-whitelist/androidApps/<appId>/sha
#   { "shaHash": "<SHA-1>", "certType": "SHA_1" }
```

> **Play-distributed testing:** both fingerprints are registered for `music-whitelist` — the
> **upload key** (`6b9f05…`, local/sideloaded builds) and the **Play App Signing key**
> (`90a7a7…`, builds served by Google Play). Add any new key from Play Console →
> *Protected with Play → Play Store distribution → Play app signing → App signing key certificate*.

Without `google-services.json` the app still builds, but native sign-in and push stay disabled.
Web Push (VAPID) is unchanged and used only by the browser PWA; native tokens and web subscriptions
are stored together per device in `push-subscriptions/{uid}`.

### Native Google Sign-In (required, easy to miss)

`@capacitor-firebase/authentication` needs **both** of these, or `signInWithGoogle()` throws
`NullPointerException` (the Google handler is never initialized):

1. `capacitor.config.ts` → `plugins.FirebaseAuthentication.providers` must include `google.com`
   (and `skipNativeAuth: true`, since the Web SDK owns the session).
2. `android/variables.gradle` → `rgcfaIncludeGoogle = true`, so `play-services-auth` and the
   Credential Manager libraries are actually packaged (otherwise they're `compileOnly`).

`variables.gradle` is versioned, but re-running `npx cap add android` regenerates it — re-add
`rgcfaIncludeGoogle = true` after doing so.

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
  --bundle android/app/build/outputs/bundle/release/app-release.aab \
  --track internal \
  --notes store/release-notes.md \
  --name "0.22.0" \
  --mapping android/app/build/outputs/mapping/release/mapping.txt \
  --dry-run

# Reuse an already-uploaded AAB on another track
node "$PLAY" upload --version-code 2200 --track alpha --notes store/release-notes.md
```

## 5. Testing requirement and promotion path

- **Internal** (`internal`): fastest, up to 100 testers, for smoke tests.
- **Closed** (`alpha`): required before production for **personal accounts created after
  2023-11-13** — a closed test with **12 testers for 14 continuous days**. The API only accepts
  Google Groups as testers; individual email lists are managed by hand in Play Console.
- **Open/Production** (`production`): after the closed test requirement is met. Use
  `--status inProgress --rollout 0.1` for a staged rollout.

A committed release goes into Google review (first review can take up to 7 days).
