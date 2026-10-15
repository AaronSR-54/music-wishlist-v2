const fs = require('fs');
const path = require('path');

const required = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

const envPath = path.join(__dirname, '../src/environments/environment.ts');
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  // Never overwrite the committed config with empty values (for example a local
  // build without a .env). On Vercel the required vars are present, so the
  // generation below runs and the environment becomes the single source of
  // truth - including VAPID_PUBLIC_KEY, which used to be ignored whenever the
  // committed environment.ts already contained `production: true`.
  console.warn(
    `Missing env vars: ${missing.join(', ')} - keeping existing environment.ts`,
  );
  if (existing) return;
}

function existingValue(key) {
  const match = existing.match(new RegExp(`${key}\\s*:\\s*'([^']*)'`));
  return match ? match[1] : '';
}

// Environment variables are authoritative when set; otherwise keep the value
// already committed in environment.ts.
const value = (envKey, tsKey) => process.env[envKey] || existingValue(tsKey);

const content = `export const environment = {
  production: true,
  firebase: {
    apiKey: '${value('FIREBASE_API_KEY', 'apiKey')}',
    authDomain: '${value('FIREBASE_AUTH_DOMAIN', 'authDomain')}',
    projectId: '${value('FIREBASE_PROJECT_ID', 'projectId')}',
    storageBucket: '${value('FIREBASE_STORAGE_BUCKET', 'storageBucket')}',
    messagingSenderId: '${value('FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId')}',
    appId: '${value('FIREBASE_APP_ID', 'appId')}',
  },
  vapidPublicKey: '${value('VAPID_PUBLIC_KEY', 'vapidPublicKey')}',
};
`;

fs.writeFileSync(envPath, content);
console.log('environment.ts generated from env vars');
