# Proposal

## Why

A release shipped for a favorite artist and the Play alpha build showed no notification. The device
simply had notifications off, because on native the feature is an opt-in toggle buried in Perfil:
until somebody flips it, no FCM token is ever registered and the daily `check-releases` run exits
with "No push registration found" before sending anything. Native users expect notifications to
behave like every other Android app — the OS owns the permission, and the app registers itself.
Two UX defects compound this: the first request for the permission never happens on its own, and
the Perfil screen (route `/profile`, rendered outside the shell) draws its header under the Android
status bar.

**Log review (as requested):** the production runtime logs for the cron runs cannot be retrieved.
Vercel's Hobby plan rejects any `--since` older than its short retention window
(`The hobby plan does not retain runtime logs for the requested time range`), and the scheduled run
  happens at 09:00 UTC while the last production deployment is 19 days old. What the code makes
certain is the outcome: with no token/subscription stored for the user, `api/check-releases.js`
returns early (`No push registration found`) and never reaches the send loop, so nothing was sent
and nothing was marked as notified for that user.

## What Changes

- **Native notifications become system-owned.** On Android, Perfil no longer offers an
  enable/disable notifications control. The app registers the device automatically whenever Android
  grants the permission, and the notification's visibility is managed from the Android notification
  settings.
- **First-launch permission request.** On the native app's first launch, ask for the Android
  notification permission (`POST_NOTIFICATIONS`) once per install, instead of waiting for a tap in
  Perfil. Do not re-prompt after a denial; re-check the permission when the app resumes and register
  the token if the user granted it from the system settings.
- **One Android-settings shortcut, always visible.** Perfil shows a single action that opens the
  app's Android notification settings, whatever the permission state is: no in-app toggle and no
  state-dependent status text.
- **Android notification channel.** Create a dedicated "Nuevos lanzamientos" channel so release
  notifications render with the app's name, importance and sound on Android 8+, and have the server
  target that channel on FCM sends.
- **Web/PWA unchanged.** The browser keeps the existing Perfil toggle and the Web Push flow.
- **Safe area on Perfil.** Respect the top and bottom system insets on the `/profile` route so the
  header and content no longer overlap the Android status bar or the gesture navigation bar.
- **Release hygiene.** Bump the `package.json` version (minor, `feat:`) as part of the change.

## Capabilities

### New Capabilities
<!-- None: native notification and inset behavior belong to existing capabilities. -->

### Modified Capabilities
- `push-notifications`: native registration no longer depends on an in-app toggle; the permission is
  requested on first launch and the device registers automatically once granted, including
  re-registration on resume and removal of the server registration when the permission is revoked;
  release notifications use a dedicated Android channel; Perfil shows native status only.
- `native-app-shell`: routes rendered outside the shell (Perfil) must respect the system bar insets,
  so their chrome never sits under the Android status bar or navigation bar.

## Impact

- `src/app/core/services/push-notification.service.ts` — first-launch prompt, automatic native
  registration on grant/resume, channel creation, no user-driven native unsubscribe.
- `src/app/core/native/native-push.ts` — extend the wrapper with `createChannel`, permission
  re-checks and the permission state needed by the first-launch flow.
- `src/app/core/native/native-shell.service.ts` — resume listener, startup prompt trigger.
- `src/app/features/profile/sections/profile-settings.component.ts` — hide the native toggle and
  offer a single, state-agnostic action that opens the Android notification settings.
- `src/app/features/profile/profile.component.ts` + `src/styles.css` — safe-area padding for the
  `/profile` route.
- `src/app/core/i18n/translations.ts` — new strings (es/en) for the denied state and system settings
  action.
- `api/push.js`, `api/check-releases.js` — FCM `android.notification.channelId`; no new endpoints
  (still 12).
- `android/app/src/main/AndroidManifest.xml` — default notification channel metadata.
- `android/app/src/main/java/com/musicwishlist/app/NotificationSettingsPlugin.java` +
  `src/app/core/native/notification-settings.ts` — one-method local plugin to open the Android
  notification settings of the app (no new npm dependency).
- `src/app/core/native/native-shell.service.ts` / `app.ts` — startup trigger for the native
  permission flow.
- `src/app/core/services/push-notification.service.spec.ts` — cover the new native flows.
- `package.json` version bump.
- Out of scope: foreground delivery of an FCM notification while the app is open (Android shows
  notification payloads only when the app is backgrounded). The release detector now checks a
  two-calendar-day window and keeps deduplication state per user so daily or delayed runs do not
  miss yesterday's release or suppress another user's notification.
