# Proposal

## Why

On Android the installed app's launcher icon looks oversized: the brand mark almost touches the edge
of the round/squircle mask, which makes the icon feel cropped and cramped next to other apps on the
home screen. The current adaptive foreground is rendered at 92% of its canvas and then inset to the
108dp layer, so the mark ends up filling roughly 92% of the visible 72dp safe area; the round legacy
icon has the same "no margin" look.

## What Changes

- Reduce the brand mark's scale in the Android launcher icon so it keeps a consistent margin inside
  the adaptive-icon safe zone and inside the round/legacy icon canvas, instead of touching the mask
  edge.
- Derive that scale from the generator (`scripts/generate-native-branding.mjs`) rather than
  hand-editing each `mipmap-*` density, so `npm run android:assets` reproduces the corrected icon.
- Keep the mark's centering, the brand background (`#22201f`) and the legacy/round/adaptive variants
  visually consistent with each other and with the splash screen and PWA icon.
- Add a quick visual check of the generated icon under circle, squircle and rounded-square masks so
  future regenerations don't reintroduce the oversized mark.
- No change to the splash logo size, the web PWA manifest icons, the Play listing icon, app behavior,
  routes or data.

## Capabilities

### New Capabilities
<!-- None: this corrects the existing native branding requirement. -->

### Modified Capabilities
- `native-app-branding`: the launcher-icon requirement now specifies that the mark keeps a
  consistent, deliberate margin inside the adaptive safe zone and the round icon canvas (not merely
  that it "sits inside" the safe zone).

## Impact

- **Tooling**: `scripts/generate-native-branding.mjs` (`ICON_MARK` / `FOREGROUND_MARK` constants and
  the resulting `resources/icon-*.png` sources).
- **Android resources**: regenerated `android/app/src/main/res/mipmap-*`
  (`ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`) plus
  `mipmap-anydpi-v26/ic_launcher*.xml` (unchanged structurally).
- **Docs**: a short note in `store/README.md` / `AGENTS.md` about the intended mark scale if the
  generator constants need explanation.
- **Release**: `package.json` patch version bump; a new AAB is needed for the icon to reach devices
  through Google Play.
- No API, Firestore, auth, push, dependency or 12-endpoint-limit impact.
