# Design

## Context

See proposal.md — Why. This builds on the `migrate-twa-to-capacitor` change: Android is now a
Capacitor app (`com.musicwishlist.app`, `webDir` = bundled Angular build) and the native shell lives
in `src/app/core/native/native-shell.service.ts`.

Observed current state (what the design must account for):

- **Brand source**: the mark is a list + music note; `public/icon.svg` (stroke `#cdc5b7`) and the
  Play/PWA icons (`store/listing/images/icon.png`, `public/icons/*`) already render it. Brand colors
  are `#22201f` (dark) / `#e5e0d8` (light), mirrored in `manifest.json` and the meta theme-color.
- **Icons**: `android/app/src/main/res/mipmap-*` still hold Capacitor's default assets — a blue
  Ionic mark on a white square, with `values/ic_launcher_background.xml` = `#FFFFFF`.
- **Splash**: `drawable*/splash.png` (portrait + landscape, all densities) show the default mark on
  white. `AndroidManifest.xml` starts `MainActivity` with `AppTheme.NoActionBarLaunch`
  (parent `Theme.SplashScreen`), which only sets `android:background=@drawable/splash`.
- **Splash on Android 12+**: the `@capacitor/splash-screen` plugin calls
  `androidx.core.splashscreen.SplashScreen.installSplashScreen(activity)`, so the system splash uses
  the theme's `windowSplashScreen*` attributes; `android:background` is ignored there. Because those
  attributes are unset, the system splash falls back to the **launcher icon** on the default
  background — i.e. the default mark. `postSplashScreenTheme` is also unset.
- **Status bar**: `capacitor.config.ts` sets `StatusBar { style: 'DARK', backgroundColor: '#22201f',
  overlaysWebView: false }` and `native-shell.service.ts` calls `StatusBar.setStyle` +
  `StatusBar.setBackgroundColor` per theme. `targetSdkVersion`/`compileSdkVersion` = 36, so Android
  15+ enforces edge-to-edge and the plugin's `setBackgroundColor` is a no-op (verified in
  `@capacitor/status-bar` `StatusBar.shouldSetStatusBarColor`); `setStyle` (icon appearance) still
  works. There is no `viewport-fit=cover` and no `env(safe-area-inset-*)` handling anywhere, and the
  shell uses full-height `bg-bone-300 dark:bg-ink` containers.

## Goals / Non-Goals

**Goals:**
- Brand-correct launcher/adaptive icon and splash on all supported Android versions and densities.
- Status bar matches the active theme (background + icon contrast) alongside the navigation bar,
  including Android 15+ edge-to-edge.
- One reproducible command regenerates the native branding from the source mark.

**Non-Goals:**
- Changing the web PWA manifest or its icons (already brand-correct).
- Redesigning the in-app header/tab bar chrome.
- iOS packaging or web PWA behavior.

## Decisions

**1. Source of truth: `public/icon.svg`, composed into full-bleed PNGs.**
Generation starts from the existing brand mark so the icon/splash match the PWA and store listing.
The adaptive foreground keeps the mark inside the ~66% safe zone; the background is `#22201f`.

**2. Generate Android assets with `@capacitor/assets`.**
Add `@capacitor/assets` as a dev dependency and a `resources/` source dir (`icon.png` 1024²,
`icon-foreground.png`, `icon-background.png` `#22201f`, `splash.png` 2732² mark on `#22201f`),
driven by a `npm run android:assets` script. It emits every mipmap density, the adaptive
`mipmap-anydpi-v26` icon, `ic_launcher_background`, and `drawable*/splash.png`.
Alternative: a bespoke Node/Playwright generator reusing `scripts/generate-feature-graphic.mjs`;
rejected because it re-implements the density/adaptive matrix for no benefit. (A small wrapper may
still render the SVG to the `resources/` PNGs first.)

**3. Launch theme drives the Android 12+ splash explicitly.**
Update `AppTheme.NoActionBarLaunch` to set `windowSplashScreenBackground` = `#22201f`,
`windowSplashScreenAnimatedIcon` = the brand mark drawable and `postSplashScreenTheme` =
`AppTheme.NoActionBar`, keeping `android:background=@drawable/splash` for pre-Android-12. This is
what makes the splash show the brand mark instead of the launcher icon, and lets the activity leave
the splash theme. `SplashScreen.launchAutoHide: false` + the existing explicit `SplashScreen.hide()`
stay as-is.

**4. Embrace edge-to-edge for the status bar instead of opting out.**
`setBackgroundColor` cannot work on Android 15+; opting out via
`android:windowOptOutEdgeToEdgeEnforcement` is deprecated and gone in Android 16, so we adopt
edge-to-edge and let the app paint the bar area:
- Add `viewport-fit=cover` to the viewport meta and pad the shell with the system-bar insets so the
  strip behind the status bar shows the active theme background. Capacitor 8's built-in `SystemBars`
  plugin (default `insetsHandling: css`) injects `--safe-area-inset-*` pixel variables into `:root`,
  so the utility reads `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))` (and the bottom
  equivalent), which also covers the plain-browser PWA via `env()`.
- Keep `StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })` for icon contrast, and keep
  `setBackgroundColor` as a best-effort call for pre-Android-15 devices (harmless no-op on 15+).
- Set `overlaysWebView: true` in `capacitor.config.ts` so behavior is consistent with edge-to-edge,
  and set the Android theme status/navigation bar colors transparent.
Alternative: opt-out attribute (rejected: deprecated and removed in Android 16).

**5. Version bump = patch** (correcting shipped appearance is a `fix`-class change), per AGENTS.md.

## Risks / Trade-offs

- **Content under system bars** if safe-area insets are mishandled → test both themes on an Android
  15/16 device and an older device; verify header text is not clipped and the tab bar clears the nav bar.
- **`@capacitor/assets` overwrites hand-edited resources** → regenerate into a clean tree and review
  the diff before committing; keep the theme edits in `styles.xml` (not generated).
- **Adaptive icon safe zone** — a mark that is too large gets clipped → keep it within ~66% of the
  foreground and verify `ic_launcher_round` and any monochrome/themed variant.
- **Splash icon fallback on some OEM/API levels** → verify cold launch on Android 12+ and lower.
- **Bar strip on older WebViews** → with WebView < 140 Capacitor pads the WebView natively and the
  strip shows the theme's `windowBackground`, which follows the *system* night mode, so a forced app
  theme opposite to the system won't match the strip on those devices. Accepted limitation (WebView
  ≥ 140, the current default, honors the app theme via the safe-area CSS). Verified on an Android 16
  (API 36) emulator; on-device check of a pre-Android-15 device was not possible here (only the
  `android-36` image is installed).
- **No device available** in this environment → the on-device visual check is an explicit acceptance
  task; the change is not archived until it passes.

## Migration Plan

1. Create `resources/` sources from `public/icon.svg` and add `@capacitor/assets` + `android:assets`.
2. Regenerate the icon and splash resources; fix `ic_launcher_background` to `#22201f`.
3. Update the launch theme (`windowSplashScreen*`, `postSplashScreenTheme`) and `capacitor.config.ts`.
4. Adopt edge-to-edge: `viewport-fit=cover`, safe-area padding, status/nav bar transparent, keep
   `setStyle` + best-effort `setBackgroundColor`.
5. Bump the version, `npm run android`, and verify on device (both themes, both orientations).
6. Rollback: revert the git change and rebuild; no data or API migration involved.

## Open Questions

- Whether a physical Android 15+/16 device is available for the acceptance check now; if not, the
  check is deferred but tasks stay the same.
