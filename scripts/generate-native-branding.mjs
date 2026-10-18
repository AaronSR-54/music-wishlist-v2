#!/usr/bin/env node
// Regenerate the Android native branding (launcher icon + splash screen) from
// the brand mark in public/icon.svg.
//
// Step 1 renders the mark and composes the resources/ source images that
// @capacitor/assets consumes in custom mode:
//   resources/icon-only.png       1024²  mark on #22201f (legacy launcher icon)
//   resources/icon-foreground.png 1024²  transparent mark (adaptive foreground)
//   resources/icon-background.png 1024²  solid #22201f (adaptive background)
//   resources/splash.png          2732²  mark centred on #22201f
// Step 2 runs @capacitor/assets to emit every Android density and variant.
//
// Usage: npm run android:assets

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ICON = resolve(ROOT, 'public/icon.svg');
const RES = resolve(ROOT, 'resources');
const TMP = join(tmpdir(), 'mw-native-branding');

const BG = '#22201f';
// Bounding box of the mark (paths + half the stroke) inside the 18×18 viewBox,
// so the rendered mark fills the canvas edge to edge.
const MARK_BOX = '2.1 3 12.8 12.9';

const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;
// Mark scale as a fraction of the icon canvas. @capacitor/assets wraps the
// adaptive foreground in a 16.7% inset, which shrinks the image to the 72dp safe
// zone but keeps the mark's proportion inside it, so using the same value for the
// legacy and foreground sources keeps the adaptive, round and legacy icons at the
// same apparent scale with a comfortable margin under any launcher mask.
const ICON_MARK = 0.62;
const FOREGROUND_MARK = ICON_MARK;
const SPLASH_MARK = 0.18; // mark as a fraction of the splash canvas

function renderMark(size) {
  const svg = readFileSync(ICON, 'utf8');
  const scaled = svg
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`)
    .replace(/viewBox="[^"]*"/, `viewBox="${MARK_BOX}"`);
  const src = join(TMP, 'mark.svg');
  const out = join(TMP, `mark-${size}.png`);
  writeFileSync(src, scaled);
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), src, '-o', out]);
  return out;
}

function compose(mark, size, out, background = BG) {
  const args = ['-size', `${size}x${size}`, background ? `xc:${background}` : 'xc:none'];
  if (mark) {
    args.push(mark, '-gravity', 'center', '-composite');
  }
  execFileSync('magick', [...args, out]);
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(RES, { recursive: true });

compose(renderMark(Math.round(ICON_SIZE * ICON_MARK)), ICON_SIZE, join(RES, 'icon-only.png'));
compose(
  renderMark(Math.round(ICON_SIZE * FOREGROUND_MARK)),
  ICON_SIZE,
  join(RES, 'icon-foreground.png'),
  null,
);
compose(null, ICON_SIZE, join(RES, 'icon-background.png'));
compose(
  renderMark(Math.round(SPLASH_SIZE * SPLASH_MARK)),
  SPLASH_SIZE,
  join(RES, 'splash.png'),
);

execFileSync('npx', ['capacitor-assets', 'generate', '--android', '--assetPath', 'resources'], {
  cwd: ROOT,
  stdio: 'inherit',
});

console.log(`✓ Android icon + splash regenerated from ${ICON}`);
