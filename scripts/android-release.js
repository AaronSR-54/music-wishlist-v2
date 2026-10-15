#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const androidDir = path.join(root, 'android');

function syncVersion() {
  const result = spawnSync('node', [path.join(__dirname, 'sync-android-version.js')], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function resolvePassword() {
  if (process.env.BUBBLEWRAP_KEYSTORE_PASSWORD) {
    return process.env.BUBBLEWRAP_KEYSTORE_PASSWORD;
  }
  const passwordFile = path.join(
    os.homedir(),
    '.config/music-wishlist/keystore.password',
  );
  if (fs.existsSync(passwordFile)) {
    return fs.readFileSync(passwordFile, 'utf8').trim();
  }
  console.error(
    'No keystore password found. Set BUBBLEWRAP_KEYSTORE_PASSWORD or create ' +
      `${passwordFile} (chmod 600).`,
  );
  process.exit(1);
}

function runBubblewrap(args, env) {
  const binary = path.join(root, 'node_modules/.bin/bubblewrap');
  const result = spawnSync(binary, args, { cwd: androidDir, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

syncVersion();

const password = resolvePassword();
const env = {
  ...process.env,
  BUBBLEWRAP_KEYSTORE_PASSWORD: password,
  BUBBLEWRAP_KEY_PASSWORD: password,
};

runBubblewrap(['update', '--skipVersionUpgrade'], env);
runBubblewrap(['build'], env);

console.log('\nAAB: android/app-release-bundle.aab');
console.log('mapping: android/app/build/outputs/mapping/release/mapping.txt');
