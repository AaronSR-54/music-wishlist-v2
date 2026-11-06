# Design

## Context

See `proposal.md` — Why for the motivation and the log-review outcome. The relevant current state:

- `PushNotificationService` is only instantiated when Perfil renders, so nothing asks for the
  Android permission at launch. Native activation is a manual toggle (`subscribe()` →
  `requestPermissions()` → `register()`), and `reconcileNative()` only re-registers when auth state
  changes and the permission is already granted.
- The `registration` listener persists the FCM token only if a user is authenticated at that moment,
  so an early grant (before login) is recovered later by `reconcileNative()`.
- Android is `targetSdkVersion 36`, so `POST_NOTIFICATIONS` is a runtime permission (API 33+);
  min SDK is 24, where granting is implicit.
- `@capacitor/push-notifications` 8 defines `createChannel`/`deleteChannel` and reports
  `PermissionState` values `granted | denied | prompt | prompt-with-rationale`; no channel is
  created today and the server sends FCM without an `android.notification` block.
- `api/push.js` and `api/check-releases.js` each own a `sendFcm()` helper that posts a `notification`
  + string `data` message with `android.priority = high`.
- The `/profile` route is a sibling of the shell in `app.routes.ts`; `ProfileComponent`'s root has no
  inset padding, while the shell uses `.safe-area-inset-top`. Capacitor 8's `SystemBars` injects
  `--safe-area-inset-*` into `:root`, so the variables are already available outside the shell.

## Goals / Non-Goals

**Goals:**
- Make the native permission/registration lifecycle explicit, idempotent and independent of any
  Perfil control, with a single startup entry point.
- Keep the browser (Web Push) path unchanged.
- Give release notifications a stable Android channel that the server targets.
- Fix Perfil's system-bar spacing with the existing inset utilities rather than native layout code.

**Non-Goals:**
- Showing a notification while the app is in the foreground; Android only displays FCM
  `notification` payloads when the app is backgrounded. A local-notification fallback would need
  `@capacitor/local-notifications` and is left for a future change.
- Changing the daily release window (`RELEASE_WINDOW_DAYS`), the cron schedule, or how the server
  decides what counts as a new release.
- Re-prompting or deep-linking users who already denied the permission (the Perfil shortcut is the
  only recovery path).
- Redesigning the notifications row for the browser.

## Decisions

### 1. Native registration is driven by permission state, not by a toggle

Add `initializeNative()` to `PushNotificationService`, called once from `NativeShellService` right
after the splash hides (native only). It:

1. creates the release channel (best effort, no-op below Android 8);
2. maps `checkPermissions().receive` to the existing `permissionState` signal
   (`granted` → granted, `denied` → denied, `prompt*` → `default`);
3. if granted → `register()` (the existing `registration` listener persists the token whenever the
   user is authenticated, and the auth effect re-registers after login);
4. if still in `prompt` and the install has never asked → `requestPermissions()`, then `register()`
   when granted;
5. records that the prompt was shown *before* calling `requestPermissions()`, in
   `localStorage['mw-native-notif-asked-v1']`, so a dismissal or denial is never re-asked
   automatically.

`isSubscribed` for native becomes "token registered / permission granted" rather than a user
preference. `subscribe()`/`unsubscribe()` stay in the service for the browser only; the native
branches either delegate to `initializeNative()` (subscribe) or are no longer reachable from the UI.

*Alternatives considered:* keeping the toggle and merely defaulting it to on (still a hidden opt-in
and a second source of truth next to Android); prompting from Perfil on first visit (users who never
open Perfil would never be asked, which is the current failure).

### 2. Re-check the permission on resume

Add a `resume` listener (from `@capacitor/app`, already a dependency) in the native branch:
- permission now `granted` and not subscribed → `register()`;
- permission no longer `granted` while the service considered itself subscribed → call the existing
  `postUnsubscribeNative()` and clear `isSubscribed`.

This is the only supported recovery path for a user who enables notifications in Android settings
after denying; the app never re-shows the system dialog.

### 3. Dedicated Android channel `releases`

`createChannel({ id: 'releases', name: <i18n>, importance: 4, sound: 'default', vibration: true,
visibility: 1 })` on every native launch so the channel name follows the app language. The channel
name and description come from two new i18n keys (es/en).

The server's two `sendFcm()` helpers add:

```js
android: {
  priority: 'high',
  notification: { channelId: 'releases', sound: 'default' },
}
```

and `android/app/src/main/AndroidManifest.xml` gains the
`com.google.firebase.messaging.default_notification_channel_id` meta-data pointing at `releases` as
the fallback for any message sent without an `android` block.

*Alternatives considered:* relying on the fallback "Miscellaneous" channel FCM creates (no stable
name/importance and no user-visible grouping); sending data-only messages and posting local
notifications (needs a new plugin and custom tap handling, no benefit here).

### 4. Perfil shows a single, state-agnostic shortcut to Android notification settings

In `profile-settings.component.ts`, when `pushSvc.isNative` the notifications row renders exactly
one action ("Ajustes de notificaciones" / "Notification settings"). It does not depend on the
permission state: no enable/disable control, no "activadas/bloqueadas" label and no branch that
swaps the button for text. The shortcut is available both to enable notifications after a denial and
to review or adjust them when they are already granted.

Opening that screen needs an intent no current plugin exposes. Add a minimal local Capacitor plugin
`NotificationSettings` (Java, one method) that starts `Settings.ACTION_APP_NOTIFICATION_SETTINGS`
with `EXTRA_APP_PACKAGE`, falling back to `ACTION_APPLICATION_DETAILS_SETTINGS`. Register it in
`MainActivity` and wrap it in a typed TS service.

*Alternatives considered:* adding `capacitor-native-settings` (a whole dependency for one intent);
hiding the button when granted with a read-only status (state-dependent and leaves no way to reach
Android settings from the app); text-only notice on denial (dead end, since Android will not show
the dialog again on its own).

### 5. Perfil uses the existing inset utilities

Add `.safe-area-inset-bottom` next to the existing `.safe-area-inset-top` in `src/styles.css`, and
apply both to the `/profile` root container. The root already owns the page background, so padding it
keeps the header below the status bar and the last row above the gesture bar without changing any
child layout; the inner scroll area keeps its current padding. Web insets are zero, so the browser
layout is unchanged.

*Alternatives considered:* padding the header only (the bottom inset would still be missing); adding
padding to every section (uneven gaps and duplicated rules).

## Risks / Trade-offs

- **Permission prompt appears before the user understands the app** → it is shown after the splash,
  once per install; a denial leaves the app fully usable and Perfil explains how to enable it.
- **A grant before login loses the token** → the auth effect already re-runs `reconcileNative()`,
  which re-registers; the design keeps that path and adds no new token cache.
- **Users who denied earlier get no automatic prompt** → recovered through the Perfil shortcut to
  Android settings plus the resume re-check.
- **Channel name uses the language at creation time** → the channel is re-created on each launch, so
  a language switch updates it; Android keeps the user's per-channel preferences (sound/block).
- **Custom plugin build/compat risk** → one intent with a documented fallback; verified on device
  before release. No new npm dependency and no manifest permission.
- **Server sends a channelId that older app builds ignore** → harmless; FCM falls back to the
  default channel when the id is unknown, and the web path is untouched.
- **Logs remain the only post-deploy evidence** → because Hobby retention is short, verification
  must happen within the retention window after a manual test send.

## Migration Plan

1. Deploy the backend change first (channelId is additive and safe for installed builds).
2. Build and publish the app update. On the first launch after the update: an install with the
   permission still undetermined gets the prompt; an install that already granted keeps its token; an
   install that denied stays silent.
3. Verify on a device with the Play alpha build: prompt appears once, `Perfil` shows no toggle, a
   test send reaches the shade under the app channel, and `vercel logs --since 1h -q 'push'`
   reports the send while the retention window is open.
4. Rollback: reverting the client restores the previous toggle; the server change can stay (unknown
   channel ids fall back). No data migration is required: existing `push-subscriptions` documents are
   reused as-is.

## Open Questions

None.
