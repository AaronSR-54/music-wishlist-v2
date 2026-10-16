const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'),
);

const [major, minor, patch] = packageJson.version.split('.').map(Number);
const versionCode = major * 10000 + minor * 100 + patch;

const gradlePath = path.join(__dirname, '../android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');

gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${packageJson.version}"`);

fs.writeFileSync(gradlePath, gradle);

console.log(
  `✓ android version synced: ${packageJson.version} (versionCode ${versionCode})`,
);
