# Proposal

## Why

The app published on Google Play opens with a browser URL bar instead of running as a native
app. It is a Trusted Web Activity (TWA) that loads the remote site, and verification fails because
the served Digital Asset Links must match the Play App Signing key. Rather than keep paying the
TWA/asset-links tax and depending on remote-fetch details, we replace the TWA with a **Capacitor**
Android app that bundles the Angular build locally and gives a real native shell.

## What Changes

- **BREAKING**: Replace the Bubblewrap TWA (`android/`) with a Capacitor Android project that
  bundles the Angular production build **inside** the app and loads it from the local WebView
  origin. No Digital Asset Links and no URL bar.
- **BREAKING**: Route all HTTP calls to the Vercel API through an absolute base URL, because the
  WebView origin is no longer the production origin.
- **BREAKING**: Move Google Sign-In from the web popup (`signInWithPopup`) to a native Capacitor
  plugin flow, including the reauthentication step used by account deletion. The web popup is
  blocked inside Android WebViews.
- **BREAKING**: Move Android push from Web Push/VAPID + service worker to **Firebase Cloud
  Messaging** via `@capacitor/push-notifications`: register the device token, store it in
  `push-subscriptions/{uid}`, and deliver release/downloaded/test notifications through FCM. Web
  Push stays for the browser PWA.
- Derive the Android `versionCode`/`versionName` from `package.json` in the Capacitor
  `build.gradle` (were derived in `twa-manifest.json`), and keep the signed-AAB + `mapping.txt`
  release flow.
- Handle native shell behaviors: Android back button, deep links/notification taps opening the
  right route, and an app background/launch color matching the brand.
- Remove TWA-only assets and config: `public/.well-known/assetlinks.json`, `vercel.json` header
  rule, `twa-manifest.json`, Bubblewrap tooling and scripts, and their docs.
- Keep the web PWA installable and the Vercel-hosted site unchanged for browsers.

## Capabilities

### New Capabilities
- `native-app-shell`: The Android app is a Capacitor WebView that runs the bundled Angular build
  locally, with native shell behaviors (standalone launch, back button, deep links, version and
  update lifecycle) and no Digital Asset Links requirement.
- `native-authentication`: Google Sign-In on the native app through a Capacitor plugin, integrated
  with Firebase Auth and the reauthentication needed for account deletion.

### Modified Capabilities
- `android-play-distribution`: TWA verification and asset-links requirements are removed; the
  signed-AAB build, version derivation and Play publish flow are re-homed on Capacitor/Gradle.
- `push-notifications`: adds the native FCM transport for the Android app (token registration and
  server-side delivery) while keeping Web Push for the browser PWA.
- `account-deletion`: native reauthentication and native push-token cleanup replace the web popup
  and browser push subscription.
- `pwa-install-experience`: drops TWA-specific launch behavior; the installable PWA path is
  unchanged.

## Impact

- **Android**: new `android/` Capacitor project; remove `android/twa-manifest.json`,
  Bubblewrap/`@bubblewrap/cli`, `scripts/sync-android-version.js`, `scripts/android-release.js`
  (rewritten for Capacitor/Gradle), `scripts/set-env.js` API base handling.
- **Client**: `AuthService` (`signInWithPopup`/`reauthenticateWithPopup`),
  `PushNotificationService`, `main.ts` (service-worker registration), `app.config.ts`, new
  Capacitor plugins/config.
- **Backend**: `api/push.js` and `api/check-releases.js` switch from `web-push` to FCM HTTP v1
  (service-account OAuth2, already used). No new `api/*.js` files (12-endpoint limit).
- **Config/infra**: `public/.well-known/assetlinks.json`, `vercel.json` assetlinks header,
  `public/service-worker.js` (web-only), `manifest.json`, `store/README.md`, `AGENTS.md`.
- **Dependencies**: add `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`,
  `@capacitor-firebase/authentication`, `@capacitor/push-notifications`; drop
  `@bubblewrap/cli` and `web-push`.
- Requires a Firebase Android app (`google-services.json`) and FCM-enabled project, plus Play
  Console App Signing key (used for the native build, no longer for asset links).
- Existing Play installs update in place; no data migration (Firestore documents unchanged).
