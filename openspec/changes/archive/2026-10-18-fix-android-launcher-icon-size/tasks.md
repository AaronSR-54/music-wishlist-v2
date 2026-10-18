# Tasks

## 1. Generator scale

- [x] 1.1 In `scripts/generate-native-branding.mjs`, set `FOREGROUND_MARK` to the same value as `ICON_MARK` (`0.62`) and document the constant as "mark fraction of the canvas; the 16.7% adaptive inset makes the visible proportion match this fraction". Verify the file parses with `node --check scripts/generate-native-branding.mjs`.
- [x] 1.2 Run `npm run android:assets` and verify it exits 0 and regenerates `resources/icon-foreground.png` plus every `android/app/src/main/res/mipmap-*` icon, with the mark bounding box at ~57% wide × ~62% tall of the `resources/icon-foreground.png` canvas (`magick identify -format "%@" resources/icon-foreground.png`).

## 2. Adaptive, round and legacy icon proportions

- [x] 2.1 Verify `mipmap-xxxhdpi/ic_launcher_foreground.png` and `mipmap-xxxhdpi/ic_launcher_round.png` show the mark at the same apparent scale (mark height/width within a few percent of each other), and spot-check `mipmap-mdpi` for the same proportion, so every density matches.
- [x] 2.2 Render masked previews of the adaptive layers (background + foreground with the `16.7%` inset) under a circle, a squircle and a rounded-square mask at 192×192 and verify the whole mark stays visible with a visible margin and is never clipped or touching the mask edge.
- [x] 2.3 Verify the splash assets did not change (`SPLASH_MARK` untouched): compare `resources/splash.png` and `android/app/src/main/res/drawable*/splash.png` dimensions/visual output before and after regeneration and confirm no visual difference.

## 3. Documentation

- [x] 3.1 Add a short note to `store/README.md` (native branding section) and, if useful, the `AGENTS.md` key-paths row that the launcher mark scale lives in `scripts/generate-native-branding.mjs` and that adaptive, round and legacy variants share the same proportion; verify the documented `npm run android:assets` command still matches what the script does.

## 4. Build and device verification

- [x] 4.1 Bump `package.json` version (patch, e.g. `0.22.5` → `0.22.6`) per the project versioning rule and verify `scripts/sync-android-version.js` would derive the matching `versionCode`.
- [x] 4.2 Run `npm run android` and verify the signed AAB and `mapping.txt` are produced with the bumped `versionCode`/`versionName`.
- [x] 4.3 Install the build on an emulator or device and verify the launcher icon shows the brand mark with a comfortable margin (circle/squircle launcher), the icon does not look cropped, and the splash screen is unchanged.

## Workflow follow-up

- Archive the change after the on-device icon verification passes and the AAB is ready to upload.
