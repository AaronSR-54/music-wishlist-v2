# Proposal

## Why

The Capacitor Android app still ships Capacitor's template assets: the launcher icon is the blue
Ionic mark on a white square and the splash screen shows the same default mark. On top of that the
status bar does not match the app's theme, because the app targets Android 15+ where edge-to-edge is
enforced and the plugin's status-bar background call is a no-op. The result is an app that looks
unfinished next to the brand presented in the Play listing (which already uses the correct logo).

## What Changes

- Replace the Android launcher/adaptive icon (foreground, background, round and monochrome variants)
  with the brand mark (list + music note, `#cdc5b7` on `#22201f`) so the installed app identity
  matches the PWA manifest and the Play listing.
- Regenerate the splash screen for every density (portrait and landscape) from the brand asset so it
  renders the brand mark centered on the app background instead of the default Capacitor mark on
  white.
- Make the status bar follow the active light/dark theme on all supported Android versions, including
  Android 15+ edge-to-edge, so the bar's background and icon contrast match the navigation bar
  (which already looks correct).
- Add a repeatable way to regenerate the native icon and splash assets from the source brand asset,
  so the native branding can be refreshed without hand-editing each density.
- No change to the web PWA manifest (`public/manifest.json` already uses the brand icons) and no
  change to app behavior, routes or data.

## Capabilities

### New Capabilities
- `native-app-branding`: The Android app presents the brand consistently as a native app — launcher
  and adaptive icon, splash/launch screen, and themed system bars (status and navigation) with
  correct icon contrast on every supported Android version.

### Modified Capabilities
<!-- None: the in-flight `native-app-shell` capability (migrate-twa-to-capacitor) owns launch/nav
     behavior; this capability owns the brand mark rendering and system-bar theming. -->

## Impact

- **Android resources**: `android/app/src/main/res/mipmap-*` (`ic_launcher`, `ic_launcher_round`,
  `ic_launcher_foreground`), `mipmap-anydpi-v26/ic_launcher*.xml`,
  `values/ic_launcher_background.xml`, `drawable*/splash.png` (all densities, portrait + landscape),
  `values/styles.xml` (launch/app theme), and `AndroidManifest.xml` icon references if they change.
- **Config**: `capacitor.config.ts` (`SplashScreen` / `StatusBar` options).
- **Client**: `src/app/core/native/native-shell.service.ts` (status-bar/edge-to-edge handling).
- **Tooling**: a new generation script (or `@capacitor/assets`) driven from `public/icon.svg`, plus a
  `package.json` script and a patch/minor version bump.
- **Docs**: `store/README.md` and `AGENTS.md` note how native branding assets are produced.
- **Dependencies**: optionally add `@capacitor/assets` as a dev dependency.
- No API, Firestore or 12-endpoint-limit impact.
