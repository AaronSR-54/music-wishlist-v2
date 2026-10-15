# Design

## Context

See `proposal.md` for motivation, and `specs/pwa-install-experience/spec.md` / `specs/android-play-distribution/spec.md` for the required behavior.

Current relevant state in this repo:

- `src/index.html` declares two `theme-color` metas (`#e5e0d8` light, `#22201f` dark) with `prefers-color-scheme` media queries.
- `public/manifest.json` declares `theme_color: "#0e0e0e"` and `background_color: "#22201f"`, plus `any` + `maskable` icons and screenshots; it is missing `id`, `scope`, `lang`, `dir`, `display_override`, `orientation`, `categories`.
- `src/app/core/theme/theme.service.ts` computes the effective theme (`light`/`dark`/`system`) and toggles the `dark` class but never touches the `theme-color` meta. Because a user-forced theme can disagree with the OS `prefers-color-scheme`, the media-query metas alone cannot represent the active theme.
- There is no Android project, no Digital Asset Links file, and no release tooling. There is a `google-play-console` skill whose canonical script is `scripts/play.mjs`, credentials at `~/.config/google-play/service-account.json`, and which infers the package from `android/app/build.gradle`.
- Hosting is Vercel on the free plan (12/12 serverless endpoints used) — new distribution files must be static.

## Goals / Non-Goals

**Goals:**

- Installed PWA chrome (status bar/toolbar) always matches the active theme, in both forced and system themes.
- One consistent source of truth for theme/background colors across manifest and HTML.
- A reproducible TWA build producing a signed `.aab` + `mapping.txt`, versioned from `package.json`.
- Publish/deploy to Play tracks through the existing CLI without new serverless endpoints.

**Non-Goals:**

- Rewriting the web app or bundling web assets into a native shell (Capacitor) — the TWA keeps loading the hosted origin.
- Making the TWA's native system bars dynamic at runtime (not supported yet; see Decisions/Risks).
- Migrating away from Vercel or changing API surface.
- Store graphics/listing copy generation beyond localized release notes and documented prerequisites.

## Decisions

### 1. Package as a Trusted Web Activity via Bubblewrap
Use `@bubblewrap/cli` to generate an `android/` TWA project that loads the production origin.
- **Why**: the app already is a hosted PWA; a TWA reuses it unchanged, keeps a single codebase and one source of truth, and Bubblewrap is the tool PWABuilder is built on (CLI = scriptable/CI-friendly).
- **Alternatives considered**: Capacitor (adds a native layer and asset bundling; overkill for a hosted PWA), PWABuilder (same core but GUI-first and less reproducible in a repo).

### 2. Dynamic `theme-color` driven by `ThemeService`, with an early bootstrap script
Replace the static media-query pair with a managed `theme-color` meta updated imperatively, and add a small inline `<head>` script that sets it (plus `color-scheme`) before Angular bootstraps by reading `localStorage['app-theme']` and the OS preference.
- **Why**: a forced in-app theme can differ from the OS preference, so `prefers-color-scheme` media queries are insufficient. Updating the meta reflects the effective theme in the installed PWA (Chrome reads `theme-color` for the toolbar/status bar). The inline script prevents a wrong-color flash on launch.
- **Alternatives considered**: keep two media-query metas (fails for forced themes); CSS `color-scheme`-only (does not color the status bar).

### 3. Manifest is the single source of truth for colors
Set `manifest.json` `theme_color`/`background_color` to the app's default (dark) colors, reuse the same values as the fallback in `index.html`, and align `public/meta-tags.html` so no contradictory duplicate remains. Add the missing install identity fields.
- **Why**: avoids the current three-way mismatch and gives install/TWA tooling a stable contract. `background_color` also drives the splash background.

### 4. Android version derived from `package.json`
A pre-build script maps the project SemVer to `appVersionCode` (monotonic integer, e.g. `major*10000 + minor*100 + patch`) and `appVersionName` (the SemVer string), writing them into `android/twa-manifest.json` before `bubblewrap build`.
- **Why**: single source of truth, respects the repo's mandatory version-bump rule, guarantees increasing `versionCode`.
- **Alternatives considered**: hand-maintained `versionCode` (drifts, error-prone); CI-only derivation (not reproducible locally).

### 5. `npm run android` wraps the build
`npm run android` runs the version-sync script then `bubblewrap build` (non-interactive via `BUBBLEWRAP_KEYSTORE_PASSWORD`), yielding the bundle at `android/app/build/outputs/bundle/release/app-release.aab` and `android/app/build/outputs/mapping/release/mapping.txt`, matching what the `play.mjs` skill expects.
- **Why**: one documented command, predictable paths, CI-ready.

### 6. Static Digital Asset Links on Vercel
Serve `/.well-known/assetlinks.json` as a static file from `public/`, with SHA-256 fingerprints of the signing key, and add a Vercel header rule forcing `Content-Type: application/json`.
- **Why**: verification is what removes the TWA URL bar; static keeps the free-plan endpoint limit intact.

### 7. Signing key outside the repo
Generate the keystore outside the project (e.g. `~/.config/music-wishlist/android.keystore`, `chmod 600`), reference it from `twa-manifest.json`, and pass the password via env var. Never commit it.
- **Why**: Play uses the upload key to sign future updates; leaking or losing it is unrecoverable.

### 8. Reuse the `google-play-console` skill for publishing
Use `scripts/play.mjs status|upload` with `--dry-run` first, then commit; keep `android/app/build.gradle` as the package source so the skill's `applicationId` inference works.
- **Why**: no bespoke tooling; the skill already handles tracks, notes, mapping upload and the version-code-reuse path.

### 9. English default with system detection in `LanguageService`
Change the `LanguageService.getSavedLanguage()` fallback from `'es'` to `'en'`, keep the saved-preference and `navigator.language` detection, and reflect the active language on `<html lang>` (static default `en` in `src/index.html`, updated by the service). Set the Play Store listing's default language to English at app creation.
- **Why**: English is the requested default and a safer fallback, while Spanish is still chosen automatically when the system is Spanish.
- **Alternatives considered**: keep the Spanish fallback (contradicts the requested default); force a single language (loses detection).

## Risks / Trade-offs

- **TWA system bars are static** → Bubblewrap bakes `themeColor`/`navigationColor` into the build; dynamic runtime theming of TWA bars is still an open request (Bubblewrap #429). Mitigation: the dynamic fix targets the installed PWA (the reported case); for the TWA set `themeColor`/`navigationColor` to the dark default so at least dark users match, document the limitation, and revisit if Chrome adds support.
- **First production release may require closed testing** → personal Play accounts created after 2023-11-13 need 12 testers / 14 days before production. Mitigation: publish to `internal`/`alpha` first and document the path.
- **Asset Links misconfiguration shows the URL bar** → Mitigation: verify with the statement-list tool and the `play.mjs status` output before announcing.
- **Signing key loss** → the app can never be updated. Mitigation: key stored outside the repo, backed up, password in env/secret manager only.
- **Native build prerequisites (JDK 17 + Android SDK)** → building locally/CI needs toolchain setup. Mitigation: document prerequisites; PWABuilder remains a manual fallback.
- **Vercel may serve `.well-known` JSON with a wrong type** → Mitigation: explicit header rule + post-deploy curl check.
- **`package.json` version bump rule vs Android `versionCode`** → Mitigation: the sync script derives `versionCode` so the SemVer bump alone is enough.

## Migration Plan

1. Ship the web-layer fixes (dynamic `theme-color`, manifest/meta alignment). Deploy to Vercel — this alone fixes installed-PWA theming and is independently rollback-able via git.
2. Generate the TWA project + signing key; add `public/.well-known/assetlinks.json` and the Vercel header; deploy; verify asset links on a device.
3. Build the AAB (`npm run android`) and upload to the `internal` track with `play.mjs` (`--dry-run` first).
4. Supply store prerequisites (Data safety, content rating, privacy policy, localized release notes) and progress internal → alpha/closed → production.

**Rollback**: revert web changes via git (PWA unaffected otherwise); halt/rollback a Play track in Console; remove `assetlinks.json` to intentionally fall back to a Custom Tab.

## Open Questions

- Final `applicationId` (reverse-domain, e.g. `com.musicwishlist.app`) — immutable after the first Play upload; confirm before initializing the TWA.
- Is the Play developer account personal and created after 2023-11-13 (drives the closed-testing requirement)?
- Do account/service-account credentials already exist at `~/.config/google-play/service-account.json`, and is the app already created in Play Console?
