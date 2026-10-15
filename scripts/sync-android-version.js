const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'),
);

const [major, minor, patch] = packageJson.version.split('.').map(Number);
const versionCode = major * 10000 + minor * 100 + patch;

const manifestPath = path.join(__dirname, '../android/twa-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.appVersionName = packageJson.version;
manifest.appVersionCode = versionCode;
manifest.appVersion = packageJson.version;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `✓ android version synced: ${packageJson.version} (versionCode ${versionCode})`,
);
