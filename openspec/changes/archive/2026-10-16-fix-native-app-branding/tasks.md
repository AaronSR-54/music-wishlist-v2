# Tasks

## 1. Brand asset sources and generator

- [x] 1.1 Create `resources/` source assets from `public/icon.svg` — `icon-only.png` (1024², mark on `#22201f`), `icon-foreground.png` (1024², transparent mark), `icon-background.png` (1024², `#22201f`) and `splash.png` (2732² mark on `#22201f`) — and verify the files exist at the expected dimensions and render the brand mark on the brand background.
- [x] 1.2 Add `@capacitor/assets` as a dev dependency and an `android:assets` npm script that regenerates the Android icon and splash, and verify the script runs and reports the generated resource paths.

## 2. Launcher icon

- [x] 2.1 Regenerate `android/app/src/main/res/mipmap-*` (adaptive, round, foreground) and set `values/ic_launcher_background.xml` to `#22201f`, removing the leftover default adaptive vectors (`drawable/ic_launcher_background.xml`, `drawable-v24/ic_launcher_foreground.xml`); verify no Capacitor default mark remains, the mark sits inside the adaptive safe zone, and the round variant matches.
- [x] 2.2 Document how to regenerate the native icon/splash in `store/README.md` and `AGENTS.md`; verify the documented command runs as written.

## 3. Splash screen

- [x] 3.1 Regenerate `android/app/src/main/res/drawable*/splash.png` for all densities and both orientations; verify each file exists, matches the expected dimensions, and shows the brand mark on `#22201f`.
- [x] 3.2 Update `AppTheme.NoActionBarLaunch` in `values/styles.xml` with `windowSplashScreenBackground` (`#22201f`), `windowSplashScreenAnimatedIcon` (brand mark) and `postSplashScreenTheme` (`AppTheme.NoActionBar`); verify a cold launch shows the brand mark (not the launcher-icon fallback) and the activity leaves the splash theme.

## 4. Themed system bars (edge-to-edge)

- [x] 4.1 Add `viewport-fit=cover` to the viewport meta and safe-area padding (`env(safe-area-inset-top)` / `-bottom`) to the shell so content clears the system bars; verify in both themes that the header text is not clipped and the tab bar clears the navigation bar.
- [x] 4.2 Update `capacitor.config.ts` (`StatusBar.overlaysWebView: true`, transparent status/navigation bar colors in the Android theme) and keep `StatusBar.setStyle` plus the best-effort `setBackgroundColor` in `native-shell.service.ts`; verify switching between light and dark updates the status-bar background and icon contrast alongside the navigation bar.
- [x] 4.3 Make the Android app theme's status bar and navigation bar transparent so edge-to-edge shows the app background; verify no hard-coded bar color remains in `values/styles.xml` and a build succeeds.

## 5. Build and on-device verification

- [x] 5.1 Bump `package.json` version (patch) and run `npm run android`; verify the signed AAB and `mapping.txt` are produced and the AAB `versionCode`/`versionName` match the bumped version.
- [x] 5.2 Install the build on a device; verify the launcher icon, splash (portrait + landscape) and status bar (light + dark, plus a theme change at runtime) match the brand and leave no default Capacitor mark or white flash. Verified on an Android 16 (API 36) emulator (launcher icon, portrait + landscape splash, light/dark status bar via a runtime theme change); a pre-Android-15 device was unavailable in this environment. Caveat: on WebView < 140 the bar strip follows the system night mode (`windowBackground`) rather than a forced app theme; WebView >= 140 honors the app theme through the safe-area CSS.

## 6. Navigation bar matches the footer

- [x] 6.1 Keep the top safe-area inset on the shell container but move the bottom inset inside the tab bar (`padding-bottom: calc(1.5rem + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))`) so the gesture navigation-bar strip renders the footer background (`bg-light`/`dark:bg-dark`) instead of the page background; verify the nav bar area matches the footer in both themes.
- [x] 6.2 Give the floating player the same bottom inset so it keeps clearing the (now taller) footer; verify the player does not overlap the tab bar.
- [x] 6.3 Set the icon/gesture-handle contrast of both bars with `SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light })` in `native-shell.service.ts` (keeping the best-effort `StatusBar.setBackgroundColor`); verify the status-bar icons and navigation handle stay legible when the theme changes at runtime.
- [x] 6.4 Re-verify on device (light + dark, runtime theme change): the gesture navigation-bar area matches the footer, the header area still matches the top background, and no default/white strip remains.

## Workflow follow-up

- Archive the change after the on-device verification passes.
- Coordinate archive order with the in-flight `migrate-twa-to-capacitor` change (its `native-app-shell` capability owns launch/navigation behavior; this change owns brand rendering and system bars).
