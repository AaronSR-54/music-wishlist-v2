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

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(`Missing env vars: ${missing.join(', ')} - using existing environment.ts`);
}

const envPath = path.join(__dirname, '../src/environments/environment.ts');
if (fs.existsSync(envPath)) {
  const existing = fs.readFileSync(envPath, 'utf8');
  if (existing.includes('production: true')) {
    console.log('Using existing environment.ts');
    return;
  }
}

const content = `export const environment = {
  production: true,
  firebase: {
    apiKey: '${process.env.FIREBASE_API_KEY || ''}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN || ''}',
    projectId: '${process.env.FIREBASE_PROJECT_ID || ''}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET || ''}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}',
    appId: '${process.env.FIREBASE_APP_ID || ''}',
  },
  vapidPublicKey: '${process.env.VAPID_PUBLIC_KEY || ''}',
};
`;

fs.writeFileSync(envPath, content);
console.log('environment.ts generated from env vars');
