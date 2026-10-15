# Design

## Context

See `proposal.md` — Why, and `specs/play-store-listing/spec.md` for the required behavior.

Current state relevant to this design:

- The canonical Play tooling is the `google-play-console` skill at `~/.config/opencode/skills/google-play-console/scripts/play.mjs`. It already authenticates with a service-account JWT, opens/commits/discards Play **edits**, and has an `uploadFile` helper that POSTs to the `*/upload/...` media endpoint. Commands today: `status`, `upload`, `testers`.
- The Play Developer API exposes listing **text** via `edits.listings` (`title`, `shortDescription`, `fullDescription`, `video`) and listing **images** via `edits.images` (`upload`, `list`, `deleteall`, `delete`) keyed by BCP-47 language and `imageType` (`icon`, `featureGraphic`, `phoneScreenshots`, tablet/TV/Wear variants). No serverless work is needed to use them.
- Existing assets: `android/store_icon.png` (512×512) and `public/icons/icon-512x512.png`; ad-hoc screenshots at `public/screenshots/` (desktop 1920×1080, login 2549×1425, mobile 540×720); **no** feature graphic. `store/release-notes.md` already holds `<es-ES>`/`<en-US>` blocks in the skill's notes format.
- The app is demoable without Firebase credentials via `?demo` + `demo`/`1234`; demo mode renders the real UI with no visible banner, so it is suitable for store captures. Mobile layout is the `<768px` shell; app routes include the shell tabs (releases, search, wishlist) plus `/artist/:id`, `/album/:id`, `/profile`, `/login`.
- Brand tokens live in `tailwind.config.js`: ink `#22201f`, bone `#cdc5b7`, accent track/album/ep/artist (light + dark). `ImageMagick` (`convert`, `identify`) and `ffmpeg` are available on the machine.
- Constraints: Vercel free plan is at 12/12 serverless endpoints (no new `api/*.js`); assets are static repo files; the mandatory `package.json` version-bump rule applies. Play images are per-language and uploads **append**, so re-runs need explicit clearing.

## Goals / Non-Goals

**Goals:**

- One canonical `listing` command in `play.mjs` that applies localized text + graphics within a single edit, with a dry-run.
- Listing copy and images versioned in the repo (`store/listing/`), the store page reproducible from a clean checkout.
- Play-compliant assets, validated before any commit.

**Non-Goals:**

- Promotional YouTube video, tablet/TV/Wear screenshots, per-language graphics (icon/feature graphic are shared).
- Automating Play Console-only steps (app creation, Data safety, content rating) or the review/approval flow.
- Changing the app UI, adding endpoints, or altering the release/AAB pipeline (`pwa-theme-and-play-release` owns that).

## Decisions

### 1. Extend the skill's `play.mjs` with a `listing` command
Add `listing` to the existing script rather than a new repo script.
- **Why**: it already has auth, edit lifecycle and the media-upload helper; keeping one canonical CLI avoids duplicating JWT/edit handling. Matches the user's chosen approach and the skill's convention of one canonical script.
- **Alternatives considered**: a repo-local `scripts/play-listing.js` (duplicates auth, drifts from the skill); direct REST calls in CI (same duplication).

### 2. Listing copy as one JSON file per language
Store `store/listing/listing.en-US.json` and `store/listing/listing.es-ES.json` with `title`, `shortDescription`, `fullDescription`.
- **Why**: machine-readable, trivially length-checkable, maps 1:1 to the `Listing` resource, and avoids re-parsing prose. English is the default listing language; `es-ES` is the additional one.
- **Alternatives considered**: Markdown with front-matter (extra parsing); hardcoding copy in the script (fails the "version-controlled source" requirement).

### 3. Pre-flight validation before opening the edit
Validate every copy field against Play's limits (title ≤ 30, short ≤ 80, full ≤ 4000) and every image against format/dimension rules (icon 512×512, feature graphic 1024×500, phone screenshots JPEG or 24-bit PNG with no alpha, min dimension ≥ 320, max dimension ≤ 3840, max ≤ 2× min). Fail fast and name the offending file/field.
- **Why**: the API rejects or silently no-ops bad images; catching it locally is faster and clearer than a failed commit.

### 4. Upsert text, then reset-and-upload images
For each configured language: `PUT /edits/{id}/listings/{language}` with the text, then `DELETE .../{language}/phoneScreenshots` (deleteall) followed by one `POST .../upload` per screenshot; upload `icon` and `featureGraphic` once against the default language.
- **Why**: Play image uploads **append**; `deleteall` before re-uploading makes re-runs idempotent (no duplicate/accumulated screenshots) and enforces the ≤8 limit. Uploading icon/feature graphic once avoids per-language duplication since Play treats them as global.
- **Alternatives considered**: diff-and-patch existing images (more API calls, fragile); overwrite via a single PUT (not supported for images).

### 5. Screenshots captured with a scripted phone-viewport browser, per language
Add a dev-only capture script (`scripts/capture-store-screenshots.mjs`) using Playwright against the local dev server in demo mode at a 1080×1920 (9:16) viewport, navigating the shell tabs and detail routes and writing raw PNGs to `store/listing/images/<lang>/`. `STORE_CAPTURE_LANG` fixes the app language (it seeds `app-language` in localStorage) so each set is fully localized; `play.mjs listing` uploads `images/<language>/*.png` per language (falling back to flat `images/*.png`).
- **Why**: reproducible, covers every section on demand, and keeps captures free of device frames/overlays. Demo mode needs no Firebase credentials. Capturing per language means the en-US and es-ES store pages each show their own UI language.
- **Alternatives considered**: manual device captures (not reproducible, easy to miss sections); dependency-free Chrome DevTools Protocol client (fragile, still needs the browser installed); Puppeteer (equivalent to Playwright, no advantage here). Playwright is a devDependency only, and the script documents a manual-capture fallback if the browser toolchain is unavailable.

### 6. Feature graphic rendered from the real brand assets
Generate the 1024×500 feature graphic with a script (`scripts/generate-feature-graphic.mjs`) that renders, in a headless browser, the real `public/icon.svg` mark next to the header wordmark *Music Wishlist.* using the app's display font (Satoshi) and colors, then flattens it to a 24-bit PNG committed as the source of truth.
- **Why**: reproduces the header logo exactly (same SVG, same text and font) instead of an invented mark, stays in the repo and is reproducible, and needs no design tooling.
- **Alternatives considered**: ImageMagick composition (could not use the real web font or the exact wordmark styling); hand-drawn wordmark (off-brand, the original mistake).

### 7. Dry-run reuses the existing edit-discard semantics
`listing --dry-run` performs the full upload then discards the edit (never commits), mirroring `upload --dry-run`.
- **Why**: consistent UX and lets operators verify what would change without touching the live page.

## Risks / Trade-offs

- **Per-language image no-ops** → the API silently drops images for a language with no listing. Mitigation: upsert the listing text first for each language, and verify with `edits.images.list` after commit.
- **Uploaded screenshots accumulate** → Mitigation: `deleteall` the type before re-uploading; keep ≤8 captures.
- **Alpha or wrong-size images rejected** → Mitigation: pre-flight validation (Decision 3) rejects non-compliant files locally.
- **Playwright weight / missing browser** → devDependency plus `playwright install chromium`; documented manual-capture fallback. If unacceptable, captures can be committed by hand without changing the spec.
- **Editing a global skill from this repo** → the skill lives outside the repo; changes must be coordinated and kept compatible with existing `status`/`upload`/`testers` commands. Mitigation: additive command, no changes to existing flags.
- **Demo-mode UI differs from real data** → screenshots show demo content. Accepted: demo mode renders the genuine UI with no banner; content is illustrative.
- **Listing changes go through Google review** → Mitigation: expected; apply early and verify status separately from AAB releases.
- **`aiGeneratedState` on images** → leave at the default (not AI-generated); the feature graphic is composed from brand assets.

## Migration Plan

1. Author copy (`store/listing/*.json`) and images (`store/listing/images/`), validate locally.
2. Run `listing --dry-run`; confirm the edit mounts and lists the expected text/images.
3. Run `listing` for real (commit), then verify with `edits.listings.get` and `edits.images.list` per language.
4. Monitor the store page for Google review.
- **Rollback**: `store/listing/` is version-controlled, so `git revert` of a copy/image change followed by a re-run restores the previous listing; the edit-discard covers accidental dry-runs.

## Open Questions

- Confirm the Spanish locale code to publish as `es-ES` (vs a broader `es`) once the store listing languages are set in Play Console.
