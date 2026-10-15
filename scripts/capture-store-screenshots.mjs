#!/usr/bin/env node
// Capture raw, Play-ready phone screenshots of every app section.
// Dev-only helper for the `play-store-listing` change.
//
// Usage:
//   npm run store:screenshots                 # English set -> images/en-US/
//   STORE_CAPTURE_LANG=es npm run store:screenshots   # Spanish set -> images/es-ES/
//   STORE_CAPTURE_URL=http://localhost:4200 npm run store:screenshots
//
// It opens the app in demo mode (`?demo`), forces the app language, seeds demo
// data in localStorage so the wishlist/releases tabs have content, and writes
// 1080x1920 PNGs to store/listing/images/<lang>/. No device frames or captions
// are added.
//
// Manual fallback: if Playwright/Chromium is unavailable, start `npm start`,
// open the URLs below on a phone-sized window (360x640, 3x) in demo mode and
// save the screenshots by hand to the same paths.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LANG = process.env.STORE_CAPTURE_LANG ?? 'en';
const LOCALE = process.env.STORE_CAPTURE_LOCALE ?? (LANG === 'es' ? 'es-ES' : 'en-US');
const OUT_DIR = resolve(__dirname, `../store/listing/images/${LOCALE}`);
const BASE = process.env.STORE_CAPTURE_URL ?? 'http://localhost:4200';
const VIEWPORT = { width: 360, height: 640 };
const SCALE = 3; // 360x640 @3x -> 1080x1920 (9:16)

const COVERS = {
  getLucky: 'https://api.deezer.com/album/6516139/image',
  instantCrush: 'https://api.deezer.com/album/6575789/image',
  discovery: 'https://api.deezer.com/album/302127/image',
  daftPunk: 'https://api.deezer.com/artist/27/image',
  weeknd: 'https://api.deezer.com/artist/4050205/image',
};

const SCREENSHOTS = [
  { file: '01-releases.png', url: `${BASE}/?demo&tab=releases`, wait: 'app-releases' },
  { file: '02-search.png', url: `${BASE}/?demo&tab=search`, search: 'daft punk' },
  { file: '03-wishlist.png', url: `${BASE}/?demo&tab=wishlist`, wait: 'app-wishlist' },
  { file: '04-artist.png', url: `${BASE}/artist/27?demo`, wait: 'app-artist' },
  { file: '05-album.png', url: `${BASE}/album/302127?demo`, wait: 'app-album' },
  { file: '06-profile.png', viaProfile: true },
];

function seedDemoData(language) {
  const now = Date.now();
  const wishlist = [
    {
      id: '1',
      trackId: '66609426',
      name: 'Get Lucky (Radio Edit)',
      artist: 'Daft Punk',
      coverUrl: 'https://api.deezer.com/album/6516139/image',
      type: 'track',
      addedAt: now,
      addedBy: 'Demo User',
      addedByUid: 'demo-user',
      downloaded: false,
      sharedWith: [],
      artistId: '27',
    },
    {
      id: '2',
      trackId: '302127',
      name: 'Discovery',
      artist: 'Daft Punk',
      coverUrl: 'https://api.deezer.com/album/302127/image',
      type: 'album',
      addedAt: now - 1000,
      addedBy: 'Demo User',
      addedByUid: 'demo-user',
      downloaded: false,
      sharedWith: [],
      artistId: '27',
      albumId: '302127',
    },
    {
      id: '3',
      trackId: '67238732',
      name: 'Instant Crush',
      artist: 'Daft Punk',
      coverUrl: 'https://api.deezer.com/album/6575789/image',
      type: 'track',
      addedAt: now - 2000,
      addedBy: 'Demo User',
      addedByUid: 'demo-user',
      downloaded: true,
      sharedWith: [],
      artistId: '27',
    },
  ];
  const favoriteArtists = [
    {
      id: '1',
      artistId: '27',
      name: 'Daft Punk',
      coverUrl: 'https://api.deezer.com/artist/27/image',
      addedAt: now,
      addedByUid: 'demo-user',
    },
    {
      id: '2',
      artistId: '4050205',
      name: 'The Weeknd',
      coverUrl: 'https://api.deezer.com/artist/4050205/image',
      addedAt: now - 1000,
      addedByUid: 'demo-user',
    },
  ];
  localStorage.setItem('wishlist-demo-user', JSON.stringify(wishlist));
  localStorage.setItem('favorite-artists-demo-user', JSON.stringify(favoriteArtists));
  if (language) localStorage.setItem('app-language', language);
}

async function isUp() {
  try {
    await fetch(BASE, { method: 'GET' });
    return true;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isUp()) return null;
  if (process.env.STORE_CAPTURE_NO_START) {
    throw new Error(`Dev server not reachable at ${BASE}. Start it with \`npm start\` first.`);
  }
  console.log(`Dev server not up; starting \`npm start\` (first compile can take a while)...`);
  const child = spawn('npm', ['start'], {
    cwd: resolve(__dirname, '..'),
    stdio: 'ignore',
    detached: true,
  });
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (await isUp()) return child;
    await new Promise((r) => setTimeout(r, 2000));
  }
  process.kill(-child.pid);
  throw new Error('Timed out waiting for the dev server to start.');
}

const server = await ensureServer();
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  isMobile: true,
  hasTouch: true,
  locale: LOCALE,
});
await context.addInitScript(seedDemoData, LANG);

console.log(`Capturando set de ${LOCALE} → ${OUT_DIR}`);

try {
  for (const shot of SCREENSHOTS) {
    const page = await context.newPage();
    if (shot.viaProfile) {
      // Profile has no auth guard, so demo mode is only active after entering
      // through the shell; open the shell then click the avatar.
      await page.goto(`${BASE}/?demo`, { waitUntil: 'networkidle', timeout: 60_000 });
      const avatar = page.locator('app-header button');
      await avatar.waitFor({ state: 'visible', timeout: 30_000 });
      await avatar.click();
      await page.waitForSelector('app-profile', { timeout: 30_000 });
    } else {
      await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60_000 });
      if (shot.wait) await page.waitForSelector(shot.wait, { timeout: 30_000 });
      if (shot.search) {
        await page.fill('#search-input', shot.search);
        await page.waitForSelector('app-search-result-item', { timeout: 30_000 });
        await page.waitForLoadState('networkidle');
      }
    }
    await page.waitForTimeout(1200); // let covers/animations settle
    const path = resolve(OUT_DIR, shot.file);
    await page.screenshot({ path });
    console.log(`✓ ${shot.file}`);
    await page.close();
  }
} finally {
  await context.close();
  await browser.close();
  if (server) {
    try {
      process.kill(-server.pid);
    } catch {
      // already gone
    }
  }
}
