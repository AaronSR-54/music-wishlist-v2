# Tasks

## 1. Web theme consistency (installed PWA)

- [x] 1.1 Add an inline `<head>` bootstrap script in `src/index.html` that sets the `theme-color` meta (and `color-scheme`) from `localStorage['app-theme']` plus the OS preference before Angular loads; verify in a fresh dev context that the initial status-bar color matches the selected theme with no wrong-color flash.
- [x] 1.2 Update `ThemeService` so an `effect` writes the effective theme's background color into the managed `theme-color` meta on every theme change; verify switching light/dark/system updates the meta `content` (add/extend a `theme.service.spec.ts` unit test asserting the meta value per theme).
- [x] 1.3 Update `public/manifest.json`: set `theme_color`/`background_color` to the app's default colors and add `id`, `scope`, `lang`, `dir`, `display_override`, `orientation`, `categories`; verify with Chrome DevTools Application → Manifest that it loads with no errors and the identity fields are present.
- [x] 1.4 Align the fallback `theme-color` in `src/index.html` and `public/meta-tags.html` with the manifest so no contradictory color remains; verify by grepping for `theme-color`/`theme_color` and confirming the values agree.
- [x] 1.5 Bump `package.json` version (minor, since this is a `feat`) and update `README.md`/`AGENTS.md` to describe the dynamic theme-color behavior; verify `npm run build` succeeds and `src/version.json` reflects the new version.
- [x] 1.6 Verify the PWA install path is intact: run the Lighthouse installability audit (or Chrome's install prompt) and confirm the app installs and launches in standalone mode.

## 2. TWA Android project and Digital Asset Links

- [x] 2.1 Confirm the final `applicationId` (reverse-domain) with the user before generating the project; record the chosen value in `android/twa-manifest.json`.
- [x] 2.2 Generate the TWA project with `bubblewrap init --manifest https://<prod-host>/manifest.json` into `android/`, setting `themeColor`/`navigationColor` to the app default; verify `android/app/build.gradle` and `android/twa-manifest.json` exist with the expected `packageId`, host, and colors.
- [x] 2.3 Create the signing keystore outside the repo (e.g. `~/.config/music-wishlist/android.keystore`, `chmod 600`) and compute its SHA-256 fingerprint; verify `keytool -list` prints the fingerprint and the keystore is not tracked by git.
- [ ] 2.4 Add `public/.well-known/assetlinks.json` with the package name and fingerprint, and a `vercel.json` header rule forcing `Content-Type: application/json`; after deploy verify `curl -I` returns the JSON type and the Google statement-list check validates the relation.
- [x] 2.5 Set `fallbackType: "customtabs"` and document the fallback (URL bar shown when asset links fail) plus the static-TWA-status-bar limitation in `README.md`; verify the documented text matches the actual config.

## 3. Versioned AAB build

- [x] 3.1 Add a script that maps `package.json` SemVer to `appVersionCode` (monotonic integer) and `appVersionName`, writing them into `android/twa-manifest.json`; verify the emitted values match the current version.
- [x] 3.2 Add an `npm run android` script that runs the version sync then a non-interactive `bubblewrap build`; verify it produces a signed `app-release.aab` and `android/app/build/outputs/mapping/release/mapping.txt`.
- [x] 3.3 Verify the version derivation: bump `package.json` patch, run the sync, and confirm `appVersionCode` strictly increases and `appVersionName` matches the new SemVer; revert the test bump.

## 4. Play publishing and store prerequisites

- [x] 4.1 Confirm the service account at `~/.config/google-play/service-account.json` and its permissions, then run `node ~/.config/opencode/skills/google-play-console/scripts/play.mjs status` to list current tracks/versionCodes; verify the command returns the app's tracks without a package-inference error.
- [x] 4.2 Upload the AAB to the `internal` track with `--dry-run` first, then without it, using `--mapping` and a notes file; verify the versionCode appears on the track via a follow-up `status`.
- [x] 4.3 Add localized release notes (`<es-ES>`/`<en-US>`) under `store/release-notes.md` and document the manual Play Console steps (Data safety, content rating, privacy policy); verify the notes file parses in the `play.mjs` notes format and the docs list each step.
- [x] 4.4 Document the closed-testing requirement (12 testers / 14 days for post-2023 personal accounts) and the internal → alpha/closed → production promotion path; verify the documentation names each track and its requirement.

## 5. Integration verification

- [ ] 5.1 On a physical Android device, install both the PWA and the TWA, switch themes (light/dark/system), and confirm the installed PWA's status bar matches the active theme while the TWA loads the production origin without a URL bar; record the observed results as the acceptance check.

## 6. Default language (English)

- [x] 6.1 Change the `LanguageService` fallback to English (keep the saved preference and system/browser detection) and add `language.service.spec.ts` covering saved / Spanish-system / non-Spanish-system; verify the test passes.
- [x] 6.2 Reflect the active language on `<html lang>` (service sets it on init and on change; `src/index.html` defaults to `en`); verify the attribute updates when the language changes.
- [x] 6.3 Document the English default and system detection (app + Play listing default language) in `store/README.md`; verify the doc states the default language.

## Workflow follow-up

- Archive the change once implementation and the device verification are complete and the project's review requirements are satisfied.
- Verify the archived result: new `specs/pwa-install-experience/` and `specs/android-play-distribution/` capability specs exist and the change folder is under `openspec/changes/archive/`.
