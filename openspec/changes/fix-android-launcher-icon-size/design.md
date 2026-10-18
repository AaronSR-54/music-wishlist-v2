# Design

## Context

See `proposal.md` — Why. The Android launcher assets are produced by
`scripts/generate-native-branding.mjs`, which renders the mark from `public/icon.svg` into the
`resources/` sources and then runs `@capacitor/assets` (3.0.5) to emit every `mipmap-*` density.

Measured from the current generated files:

- The mark's rendered bounding box is ~85% wide × ~92% tall of the `resources/*` canvases.
- `resources/icon-foreground.png` uses `FOREGROUND_MARK = 0.92`; `@capacitor/assets` wraps it in an
  `inset 16.7%`, so on the adaptive icon the mark ends up ~85%/92% of the visible 72dp safe area —
  it nearly touches the mask edge on top and bottom. That is the oversized look.
- `resources/icon-only.png` uses `ICON_MARK = 0.62`; the round icon masks that canvas to a circle, so
  the mark is ~57% wide × ~62% tall of the visible circle. The legacy icon adds 8px of padding, so
  it is slightly smaller still.

In short, the adaptive foreground is the outlier; the round and legacy variants already have a
reasonable margin. The splash screen (`SPLASH_MARK = 0.18`) is out of scope and stays unchanged.

## Goals / Non-Goals

**Goals:**

- Make the adaptive icon's mark occupy the same apparent proportion as the round/legacy icon
  (~60% of the visible area), with a clear margin under circle, squircle and rounded-square masks.
- Keep one source of truth: the scale lives in the generator, so `npm run android:assets`
  reproduces identical assets for every density and orientation.
- Keep the brand background, centering and mark rendering otherwise unchanged.

**Non-Goals:**

- Resizing the splash logo, the PWA manifest icons or the Play listing icon.
- Introducing an adaptive monochrome layer (Android 13 themed icons) — no such variant exists today
  and the user asked only about the oversized mark.
- Changing the app UI, icon design, colors or the mark itself.

## Decisions

### Decision 1: Align the adaptive foreground scale with the round/legacy scale

Set `FOREGROUND_MARK` to the same value as `ICON_MARK` (`0.62`) so the adaptive, round and legacy
variants render the mark at the same apparent scale. The `16.7%` inset shrinks the foreground image
to the safe zone but does not change the mark's relative proportion inside it, so the visible mark
becomes ~57% wide × ~62% tall of the safe area — matching the round icon.

- **Alternative A**: pick an intermediate value (e.g. `0.72`) for a slightly larger mark. Rejected:
  it would leave the adaptive icon visibly larger than the round icon and reintroduce the mismatch.
- **Alternative B**: edit the generated `mipmap-anydpi-v26/ic_launcher*.xml` inset to a larger value.
  Rejected: `@capacitor/assets` regenerates that XML on every run and other launchers interpret the
  inset differently; the source asset is the correct lever.
- **Alternative C**: patch or vendor the `@capacitor/assets` template. Rejected: unneeded dependency
  coupling for a one-constant change.
- **Alternative D**: hand-resize the PNGs. Rejected: breaks reproducibility and the documented
  `npm run android:assets` workflow.

### Decision 2: Make the intent explicit in the generator

Rename/re-comment the constants so the scale is expressed as "mark fraction of the canvas" with a
note that the adaptive inset makes the visible proportion equal to this fraction. This prevents a
future regeneration from "fixing" the value back to a near-edge-to-edge mark.

### Decision 3: Verify proportion, not just presence

Verification compares the mark's bounding box against the visible area, and renders masked previews:

- `magick identify -format "%@"` (or `-trim`) on `resources/icon-foreground.png`,
  `resources/icon-only.png` and the generated `mipmap-xxxhdpi/*.png` to confirm the mark is
  ~60% of its canvas and that the foreground's mark matches the round icon's proportion.
- Composite the adaptive layers under a circle, a squircle and a rounded-square mask at 192×192 to
  confirm no clipping and even margins before rebuilding the app.
- Install the build on an emulator/device and look at the actual launcher icon.

## Risks / Trade-offs

- **Mark looks small on some launchers** → it will match the round icon, which users already see in
  most Android 12+ launchers' "app info"; if it reads too small, adjust the single constant upward
  (e.g. `0.66`) and regenerate — no other change needed.
- **Density inconsistency** → all densities derive from one 1024² source, so the proportion is
  identical; verification still samples mdpi and xxxhdpi.
- **Forgetting to ship a new AAB** → the icon only reaches devices through a new release; the task
  list requires the patch version bump and `npm run android` build.
- **Accidental splash change** → the generator rewrites splash assets too; verification compares the
  splash file hash/size before and after and expects no visual change (`SPLASH_MARK` untouched).

## Migration Plan

1. Change the generator constants, run `npm run android:assets`, and inspect the regenerated
   resources and `mipmap-*` files.
2. Bump the patch version, build the signed AAB with `npm run android`, and verify on a device or
   emulator.
3. Rollback: revert the constants to `0.92`, rerun `npm run android:assets`, and rebuild — generated
   files are fully reproducible from the script.

## Open Questions

None.
