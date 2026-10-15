# Proposal

## Why

The Android app is already buildable and uploadable to Play, but its **store listing is incomplete**: there is no feature graphic, only ad-hoc screenshots that do not cover every app section, and the short/full descriptions are not authored for Spanish + English. An incomplete listing blocks a good-looking first impression and can hold back review, so the ficha must be completed end to end.

## What Changes

- Extend the `google-play-console` skill's `play.mjs` with a **`listing` command** that, within a single Play edit, upserts the localized listing text (`title`, `shortDescription`, `fullDescription`) and uploads images (`icon`, `featureGraphic`, `phoneScreenshots`) per language, then commits — or mounts and discards with `--dry-run`.
- Author the listing copy in **English (default) and Spanish**, kept in the repo as source files.
- Produce Play-compliant **assets**: a 512×512 app icon, a 1024×500 feature graphic, and 2–8 **raw phone screenshots (no device frames or added captions) that visibly cover every app section** (releases, search, wishlist, artist, album, profile/login).
- Store listing assets and copy under `store/listing/` and document the end-to-end flow (assets → dry-run → commit) in `store/README.md`.
- Add a repo helper script so the flow is a documented single command against the skill.

## Capabilities

### New Capabilities

- `play-store-listing`: the app's Google Play store listing — its localized text, icon, feature graphic and phone screenshots — sourced from versioned repo assets and applied through the Play Developer API.

### Modified Capabilities

(none — the project has no existing specs yet; the in-flight `pwa-theme-and-play-release` change covers release/publishing mechanics, not listing content)

## Impact

- **Play tooling**: `google-play-console` skill's `scripts/play.mjs` (new `listing` command using `edits.listings` and `edits.images.upload`); no new serverless endpoints.
- **Repo assets**: new `store/listing/` (copy + images), possibly an `npm run` helper in `package.json`.
- **Screenshots**: new captures of the running app under `store/listing/images/` (raw, valid 9:16 or within Play's aspect-ratio limits).
- **Docs**: `store/README.md`.
- **Constraints**: no new `api/*.js` endpoints (Vercel 12/12 limit), assets are static files, and the mandatory `package.json` version bump rules apply.
