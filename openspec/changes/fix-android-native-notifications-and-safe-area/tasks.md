# Tasks

## 1. Native permission and registration lifecycle

- [x] 1.1 Extend `src/app/core/native/native-push.ts` with `createChannel`, `unregister` and a
  `PermissionStatus`-shaped permission type (`granted | denied | prompt | prompt-with-rationale`),
  keeping the existing `requestPermissions`/`checkPermissions`/`register`/`addListener` surface;
  verify with `npm run build`
- [x] 1.2 Implement `initializeNative()` in `PushNotificationService`: map `checkPermissions()` onto
  `permissionState`, request `POST_NOTIFICATIONS` once per install (flag
  `localStorage['mw-native-notif-asked-v1']` written before the request), register when granted, and
  create the release channel; verify the new unit tests in 1.4 pass
- [x] 1.3 Add the resume listener (`@capacitor/app`) that re-checks the permission, re-registers on
  grant, and calls `postUnsubscribeNative()` when the permission was revoked; keep `subscribe()` /
  `unsubscribe()` working for the browser and make the native branches unreachable from the UI;
  verify with `npm run build` and the tests from 1.4
- [x] 1.4 Extend `src/app/core/services/push-notification.service.spec.ts` with the fake
  `NativePush` gaining `createChannel`/`unregister`; cover prompt-once, grant → register, denial →
  no second prompt, grant after resume → register, revoked permission → server unsubscribe; verify
  with `npx ng test --watch=false --include='**/push-notification.service.spec.ts'`
- [x] 1.5 Call the new startup entry point from `NativeShellService` after `SplashScreen.hide()`
  (native only) so the prompt appears once the splash is gone and before the user reaches Perfil;
  verify in a debug build on a device that the dialog shows on first launch and does not repeat

## 2. Android notification channel and FCM targeting

- [x] 2.1 Create the `releases` channel from the client (name/description from two new i18n keys,
  importance high, default sound, vibration, public visibility) and add the
  `com.google.firebase.messaging.default_notification_channel_id` meta-data to
  `android/app/src/main/AndroidManifest.xml`; verify with `npx cap sync android` and
  `./gradlew assembleDebug` that the manifest merges without errors
- [x] 2.2 Add `android.notification.channelId = 'releases'` (and `sound: 'default'`) to the
  `sendFcm()` helpers in `api/push.js` and `api/check-releases.js`; verify with
  `node --check api/push.js api/check-releases.js` and that both helpers build the same `message`
  shape
- [x] 2.3 Document the native lifecycle change in `AGENTS.md` (push notifications section: automatic
  registration, no Perfil toggle on native, channel id) and verify the description matches the
  implemented behavior

## 3. Native-aware Perfil notifications section

- [x] 3.1 Add the local Capacitor plugin `NotificationSettingsPlugin.java` (starts
  `Settings.ACTION_APP_NOTIFICATION_SETTINGS` with `EXTRA_APP_PACKAGE`, falls back to
  `ACTION_APPLICATION_DETAILS_SETTINGS`), register it in `MainActivity`, and wrap it in a typed TS
  helper; verify the Android debug build compiles and the intent opens the app's notification screen
  on a device running Android 13+
- [x] 3.2 Update `profile-settings.component.ts`: hide the enable/disable control on native and show
  a single action that opens the Android notification settings regardless of the permission state
  (no status-dependent text); keep the current Web Push row untouched; verify with `npm run build`
  and a browser check that the web toggle still works
- [x] 3.3 Add the es/en strings for the native statuses and channel name in
  `src/app/core/i18n/translations.ts`; verify `LanguageService` resolves both languages and the app
  builds

## 4. Perfil system-bar spacing

- [x] 4.1 Add `.safe-area-inset-bottom` to `src/styles.css` (same `--safe-area-inset-bottom` /
  `env()` fallback pattern as `.safe-area-inset-top`) and apply `safe-area-inset-top` +
  `safe-area-inset-bottom` to the `/profile` root container in `profile.component.ts`; verify the
  build and that a zero inset on the web leaves the layout unchanged
- [x] 4.2 Verify on a native device with edge-to-edge: the Perfil back action and "04/ Perfil" title
  sit below the status bar, and the last content is reachable above the gesture bar; verify no
  double padding appears in the browser

## 5. Release and integration checks

- [x] 5.1 Run the full unit suite (`npm test -- --watch=false`) and `npm run build`; verify no new
  warnings in the changed services
- [x] 5.2 Bump `package.json` from `0.23.2` to `0.24.0` (minor: `feat`) and verify
  `node scripts/generate-version.js` rewrites `src/version.json`
- [ ] 5.3 Build the release AAB with `npm run android` and, after installing the result, complete the
  end-to-end check: first-launch prompt, no Perfil toggle, test notification displayed under the
  release channel, Perfil not overlapping the status bar
- [ ] 5.4 After deploying the backend, send a test notification and check
  `npx vercel logs --since 1h -q 'push'` within the Hobby retention window; record whether the send
  is reported and note that the original release logs are no longer retrievable

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result updates `openspec/specs/push-notifications/spec.md` and
  `openspec/specs/native-app-shell/spec.md`.
