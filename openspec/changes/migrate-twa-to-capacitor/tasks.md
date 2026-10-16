# Tasks

## 1. Scaffold Capacitor and bundle the web build

- [x] 1.1 Add `@capacitor/core`, `@capacitor/cli` and `@capacitor/android`; create `capacitor.config.ts` with `appId: com.musicwishlist.app`, `appName`, `webDir: dist/music-wishlist-v2/browser` and the brand background; verify `npx cap doctor` reports no missing dependency.
- [x] 1.2 Build the web app and add the Android platform (`npm run build` then `npx cap add android`); verify `android/` is generated and `npx cap sync android` copies the build into `android/app/src/main/assets/public`.
- [x] 1.3 Remove the Bubblewrap TWA project and tooling (`android/twa-manifest.json`, `@bubblewrap/cli`, `public/.well-known/assetlinks.json`, the assetlinks header in `vercel.json`); verify `rg -n "assetlinks|twa-manifest|bubblewrap" --glob '!node_modules'` returns only the docs still to update in group 6.

## 2. API base URL and CORS

- [x] 2.1 Add `apiBaseUrl` to the environment files and an `HttpInterceptor` that rewrites `/api/*` to `${apiBaseUrl}/api/*` only on a native platform; verify on the web that requests stay relative and by unit test that the interceptor prefixes native requests.
- [x] 2.2 Verify every `api/*.js` responds with `Access-Control-Allow-Origin` for the native origin, adding the header consistently where missing (no new endpoints); verify with a `curl -I -H "Origin: https://localhost"` against an endpoint.

## 3. Native authentication

- [x] 3.1 Add `@capacitor-firebase/authentication` and branch `AuthService.loginWithGoogle` on platform (native plugin vs web `signInWithPopup`); verify the web login unit test still passes and the login screen has no popup call when `Capacitor.isNativePlatform()` is true.
- [x] 3.2 Branch `AuthService.reauthenticate` (used by `deleteAccount`) on platform; verify the account-deletion flow test passes and the native path calls the plugin's reauthenticate.
- [ ] 3.3 Configure the Firebase Android app and Google OAuth Android client (package `com.musicwishlist.app` + signing SHA-1) and document the steps in `store/README.md`; verify sign-in works on a release build signed with the Play App Signing SHA-1.

## 4. Native push via FCM

- [x] 4.1 Add `@capacitor/push-notifications`, request permission and register the native token on the `pushNotificationRegistration`/`registrationError` events; store the token with the existing `clientId`; verify the token reaches `/api/push` on a device.
- [x] 4.2 Extend `api/push.js` (`subscribe`, `unsubscribe`, `test`, `notify-downloaded`) to store native tokens per device alongside web subscriptions and to send to native tokens via FCM HTTP v1 using the existing service-account OAuth2 helper; verify a test notification is delivered to a native device and a web subscription still receives its notification.
- [x] 4.3 Switch `api/check-releases.js` release notifications to FCM HTTP v1 for native tokens (keeping `web-push` for web subscriptions) and prune tokens FCM reports as unregistered; verify the daily run sends to both transports without error.
- [x] 4.4 Update `PushNotificationService` so `isSupported`/`subscribe`/`unsubscribe`/`sendTest` use the native plugin on the native platform while keeping the Web Push path for the web; verify `push-notification.service.spec.ts` passes and reflects both paths.

## 5. Native shell behavior

- [x] 5.1 Handle the Android back button through `@capacitor/app` so it walks the Angular history and only exits at the root; verify on a device that back from an album page returns to the previous route.
- [x] 5.2 Route notification taps and app links (`appUrlOpen`, `pushNotificationActionPerformed`) to the matching Angular route; verify tapping a release notification opens the album page.
- [x] 5.3 Configure `@capacitor/splash-screen` and `@capacitor/status-bar` with the brand colors; verify a cold launch shows no white flash.
- [x] 5.4 Gate service-worker registration in `main.ts` to the web platform; verify the native app does not register `service-worker.js` while the browser PWA still gets the update banner.

## 6. Build, release and documentation

- [x] 6.1 Rewrite the Android build script (`npm run android`) to sync the version into `android/app/build.gradle`, run `cap sync android` and `./gradlew bundleRelease`, emitting the signed AAB and R8 `mapping.txt`; verify the command produces both files at known paths.
- [x] 6.2 Update `store/README.md` (Capacitor build/publish flow, FCM setup, removed Digital Asset Links section) and `AGENTS.md` (architecture, paths, commands); verify commands and paths written in the docs match the repo.

## 7. Deploy, build and verify on device

- [x] 7.1 Bump `package.json` minor (feat) and verify `scripts/generate-version.js` writes the new version and the AAB `versionName`/`versionCode` match it.
- [x] 7.2 Build the release AAB and `mapping.txt`, upload to the internal track with `play.mjs`, and verify `status` lists the new versionCode.
- [ ] 7.3 On a physical device install the Play build and verify: no URL bar, Google sign-in, a test push, back/deep-link behavior, and account deletion; record the results as acceptance.

## Workflow follow-up

- Archive the change after on-device verification, and archive or delete the superseded `fix-twa-asset-links-app-signing` change.
