#!/usr/bin/env node
// Render the Play Store feature graphic (1024x500) from the real brand assets:
// the public/icon.svg mark plus the header wordmark ("Music Wishlist."), in the
// same display font (Satoshi) and colors as the app header. The page is rendered
// with the browser so the real web fonts are used, then flattened to a 24-bit
// PNG (no alpha) as Play requires.
//
// Usage: npm run store:feature

import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'store/listing/images/feature-graphic.png');
const ICON = resolve(ROOT, 'public/icon.svg');

const BG = '#22201f';
const FG = '#cdc5b7';

const iconSvg = readFileSync(ICON, 'utf8');

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@1&display=swap" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1024px; height: 500px; overflow: hidden; }
  body {
    background: ${BG};
    color: ${FG};
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 48px;
    font-family: 'Satoshi', sans-serif;
  }
  .mark { width: 150px; height: 150px; flex: none; }
  .mark svg { width: 100%; height: 100%; }
  .wordmark { font-size: 108px; font-weight: 700; line-height: 1; letter-spacing: -0.03em; }
  .wordmark .light { font-weight: 300; font-style: italic; }
</style>
</head>
<body>
  <div class="mark">${iconSvg}</div>
  <div class="wordmark">Music <span class="light">Wishlist</span>.</div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
const tmp = join(tmpdir(), 'feature-graphic-raw.png');
await page.screenshot({ path: tmp });
await browser.close();

execFileSync('magick', [tmp, '-background', BG, '-flatten', '-depth', '8', `PNG24:${OUT}`]);
rmSync(tmp, { force: true });
console.log(`✓ ${OUT}`);
