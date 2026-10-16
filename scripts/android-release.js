#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const androidDir = path.join(root, 'android');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function syncVersion() {
  run('node', [path.join(__dirname, 'sync-android-version.js')]);
}

function ensureLocalProperties() {
  const localProps = path.join(androidDir, 'local.properties');
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!fs.existsSync(localProps) && sdk) {
    fs.writeFileSync(localProps, `sdk.dir=${sdk}\n`);
  }
}

function resolvePassword() {
  if (process.env.ANDROID_KEYSTORE_PASSWORD) {
    return process.env.ANDROID_KEYSTORE_PASSWORD;
  }
  const passwordFile = path.join(
    os.homedir(),
    '.config/music-wishlist/keystore.password',
  );
  if (fs.existsSync(passwordFile)) {
    return fs.readFileSync(passwordFile, 'utf8').trim();
  }
  console.error(
    'No keystore password found. Set ANDROID_KEYSTORE_PASSWORD or create ' +
      `${passwordFile} (chmod 600).`,
  );
  process.exit(1);
}

const KEYSTORE_PATH =
  process.env.ANDROID_KEYSTORE_PATH ||
  path.join(os.homedir(), '.config/music-wishlist/android.keystore');
const KEY_ALIAS = process.env.ANDROID_KEY_ALIAS || 'android';

syncVersion();
ensureLocalProperties();
run('npm', ['run', 'build'], { cwd: root });
run('npx', ['cap', 'sync', 'android'], { cwd: root });

const password = resolvePassword();
const gradlew = path.join(
  androidDir,
  process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
);
run(
  gradlew,
  [
    'bundleRelease',
    `-PandroidKeystorePath=${KEYSTORE_PATH}`,
    `-PandroidKeystorePassword=${password}`,
    `-PandroidKeyAlias=${KEY_ALIAS}`,
    `-PandroidKeyPassword=${password}`,
  ],
  { cwd: androidDir },
);

console.log('\nAAB: android/app/build/outputs/bundle/release/app-release.aab');
console.log('mapping: android/app/build/outputs/mapping/release/mapping.txt');
