# Tasks

## 1. Listing copy (versioned source)

- [x] 1.1 Create `store/listing/listing.en-US.json` with `title`, `shortDescription` and `fullDescription` in English; verify it parses as JSON and each field is within Play's limits (title ≤ 30, short ≤ 80, full ≤ 4000 chars).
- [x] 1.2 Create `store/listing/listing.es-ES.json` with the Spanish `title`, `shortDescription` and `fullDescription`; verify it parses as JSON and each field is within Play's limits.
- [x] 1.3 Confirm the Spanish locale code with the Play Console listing languages (`es-ES` vs `es`) and use the matching key in the JSON filenames; verify the chosen code exists as a store listing.

## 2. Listing graphics

- [x] 2.1 Reuse the existing 512×512 icon (or export `public/icons/icon-512x512.png` to `store/listing/images/icon.png`); verify with `identify` that it is exactly 512×512 PNG.
- [x] 2.2 Create the 1024×500 feature graphic `store/listing/images/feature-graphic.png` from the real brand assets (`public/icon.svg` + the header wordmark in Satoshi) via `scripts/generate-feature-graphic.mjs`; verify with `identify` it is 1024×500 and 24-bit with no alpha.
- [x] 2.3 Add a dev-only `scripts/capture-store-screenshots.mjs` (Playwright devDependency) that opens the local dev server in `?demo` mode at a 1080×1920 viewport and writes raw PNGs to `store/listing/images/`; verify it runs and produces files, and document a manual-capture fallback.
- [x] 2.4 Capture phone screenshots covering releases, search, wishlist, artist, album and profile/login; verify each section appears in at least one shot and every file is a valid PNG within Play's dimension/aspect limits (no alpha).

## 3. `play.mjs` `listing` command

- [x] 3.1 Add a pre-flight validator to `play.mjs` that checks copy lengths and image format/dimensions and fails naming the offending field/file; verify with a deliberately over-length copy and an alpha PNG that it aborts before opening an edit.
- [x] 3.2 Implement the `listing` command: upsert each language's text (`PUT edits.listings`), `deleteall` + upload `phoneScreenshots` per language, and upload `icon`/`featureGraphic` once; support `--dry-run` that discards the edit; verify a dry-run mounts the edit and makes no commit and that existing `status`/`upload`/`testers` commands still work.
- [x] 3.3 Document the `listing` command (flags, copy/image layout, dry-run rule of thumb) in the skill's `SKILL.md`; verify the documented command runs as written.
- [x] 3.4 Run the command against the real app with `--dry-run`; verify via `edits.images.list` for each language that the expected icon, feature graphic and screenshots are staged and the listed text matches the JSON sources.

## 4. Apply to Play and document

- [x] 4.1 Run `listing` (without `--dry-run`) to commit the edit, then verify with `edits.listings.get` and `edits.images.list` per language that the text and images are live in the edit and subject to Google review.
- [x] 4.2 Update `store/README.md` with the listing flow (author copy/images → validate → `--dry-run` → commit → verify); verify the documented commands match `play.mjs`.
- [x] 4.3 Bump `package.json` to the next minor version, and note the listing tooling in `AGENTS.md`/README if warranted; verify `npm run build` still succeeds and `src/version.json` reflects the new version.

## 5. Integration verification

- [ ] 5.1 After Google review, open the store page in English and Spanish and confirm the title, short/full description, icon, feature graphic and every-section screenshots render correctly.

## Workflow follow-up

- Archive the change once implementation and the store-page verification are complete and the project's review requirements are satisfied.
- Verify the archived result: `openspec/specs/play-store-listing/spec.md` exists and the change folder is under `openspec/changes/archive/`.
