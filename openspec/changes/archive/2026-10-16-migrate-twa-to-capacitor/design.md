# Design

## Context

See proposal.md (Why). The current Android deliverable is a Bubblewrap TWA in `android/` that loads
`https://music-wishlist-v2.vercel.app` remotely; verification needs Digital Asset Links against the
Play App Signing key. The Angular app is served by Vercel, calls same-origin `/api/*`, uses Firebase
Auth via `signInWithPopup`, and uses Web Push (VAPID) with a custom service worker
(`public/service-worker.js`) plus `api/push.js` and `api/check-releases.js` (`web-push`).

Decisions already taken with the user: **bundle the web build locally** in Capacitor, and **migrate
Android push to native FCM**.

## Goals / Non-Goals

**Goals:**
- Android app that runs the bundled Angular build locally with no URL bar and no Digital Asset Links.
- Working Google Sign-In (including deletion reauth) and push on the native app.
- Keep the web PWA and the Vercel-hosted site behavior unchanged for browsers.
- Keep one signed-AAB + Play publishing flow and one `package.json`-derived version source.

**Non-Goals:**
- Running the web app remotely via `server.url`.
- Changing the Firestore data model or the wishlist feature behavior.
- Adding new serverless endpoints (12-endpoint cap) — FCM reuses `api/push.js` and
  `api/check-releases.js`.
- iOS packaging (out of scope; Android only).

## Decisions

**1. Bundle assets locally (`webDir = dist/music-wishlist-v2/browser`).**
Capacitor serves the built app from the local origin (`https://localhost` on Android). Alternatives:
`server.url` pointing at Vercel (rejected: keeps it a remote WebView shell, Play "minimum
functionality" risk, and still needs native plugins). Consequence: every `/api/*` call must become
absolute.

**2. Absolute API base via an HTTP interceptor.**
Add `environment.apiBaseUrl` (the production origin) and an `HttpInterceptor` that rewrites requests
whose URL starts with `/api/` to `${apiBaseUrl}/api/...` when running on a native platform; the web
keeps same-origin relative calls. Alternative: hard-code absolute URLs at each call site (rejected:
noisy, easy to miss). This trusts the existing `Access-Control-Allow-Origin: *` headers on the
endpoints — verify every `api/*.js` sets them.

**3. Native Google Sign-In with `@capacitor-firebase/authentication`.**
It wraps the native Google flow and returns a Firebase credential, and exposes `reauthenticate`, so
`AuthService.loginWithGoogle`/`reauthenticate` branch on platform: native plugin vs web
`signInWithPopup`. Requires an Android OAuth client in Google Cloud (package + signing SHA-1) and a
Firebase Android app. Alternative: `@codetrix-studio/capacitor-google-auth` (rejected: more manual
credential plumbing, no first-class reauth).

**4. Push: dual transport under one per-device model.**
Client uses `@capacitor/push-notifications`; the FCM token is sent to the existing `subscribe`
action and stored in `push-subscriptions/{uid}` alongside web subscriptions (native tokens in a
`tokens` map keyed by the same `clientId`). Server sends to web subscriptions via `web-push` and to
native tokens via **FCM HTTP v1** (`messages:send`) using an OAuth2 token from the existing service
account helper (scope `cloud-platform` covers `firebase.messaging`). Alternatives: replace Web Push
entirely (rejected: the browser PWA still needs it); add a new endpoint (rejected: endpoint cap).

**5. Keep the service worker for the web only.**
`main.ts` skips service-worker registration when `Capacitor.isNativePlatform()`; the native shell
updates through Play. The custom SW and `NEW_VERSION_AVAILABLE` banner remain for the PWA.

**6. Replace the Bubblewrap project with a generated Capacitor `android/` project.**
Remove `twa-manifest.json`, `@bubblewrap/cli`, `scripts/sync-android-version.js`,
`scripts/android-release.js` and the asset-links file/header. New build script: sync version into
`android/app/build.gradle`, `cap sync android`, `./gradlew bundleRelease`, emitting the AAB and R8
`mapping.txt`. Version stays `versionCode = major*10000 + minor*100 + patch`.

**7. Native shell behaviors.**
`@capacitor/app` `backButton` → router history; `appUrlOpen` and
`pushNotificationActionPerformed` → router navigation; `@capacitor/splash-screen` +
`@capacitor/status-bar` use the brand background. Keep `com.musicwishlist.app` as `appId` so Play
updates install in place.

## Risks / Trade-offs

- **Google OAuth misconfiguration** (wrong SHA-1 / missing Android client) → document the exact
  Google Cloud + Firebase steps; use the Play App Signing SHA-1 when testing release builds.
- **CORS from the local origin** → verify each `api/*.js` returns `Access-Control-Allow-Origin` for
  the native origin; add it consistently if missing (no new endpoints).
- **Firebase JS SDK from the local origin** → validate that Auth state and Firestore listeners work
  inside the Capacitor WebView; if not, fall back to the native plugin for auth state (does not
  change the spec).
- **Two push transports increase surface** → keep one per-device registration model and prune
  invalid FCM tokens on `UNREGISTERED`/`NOT_FOUND`, mirroring the existing 404/410 cleanup.
- **Play "minimum functionality" review** → the app has genuine native features (native auth, push,
  back/deep links); document them in the App content section.
- **Existing TWA installs** → same `appId` and Play App Signing key ideally kept; otherwise users
  must reinstall. Prefer reusing the upload key so this stays a normal update.

## Migration Plan

1. Scaffold Capacitor (`capacitor.config.ts`, `cap add android`), bundle `webDir`; remove Bubblewrap.
2. Add environment API base + interceptor; verify endpoints CORS.
3. Migrate auth to the native plugin (login + reauth); keep web popup.
4. Migrate push client (plugin + token registration) and server (`api/push.js`,
   `api/check-releases.js` → FCM).
5. Add shell behaviors (back, deep links, splash/status bar); gate SW to web.
6. Rewrite build/release scripts and docs; delete TWA/asset-links artifacts.
7. Bump version (feat → minor), build the AAB, verify on device, publish to internal/closed.
8. Rollback: revert the git change; Play can roll back to the previous release. The web PWA is
   unaffected throughout.

## Open Questions

- Whether the Firebase JS SDK keeps working from the Capacitor local origin; a short spike answers
  it and, if it fails, only the auth-state wiring changes (specs unaffected).
- Where the native build gets `google-services.json` (committed vs. generated at build time) —
  decide during implementation without changing the approach.
