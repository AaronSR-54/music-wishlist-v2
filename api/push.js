// firebase-admin NOT used here — avoids gRPC/OpenSSL issues on Vercel.
// User's own ID token authenticates directly against Firestore REST API.
// Security rules enforce userId isolation.
//
// Push has two transports: Web Push (VAPID) for the browser PWA and Firebase
// Cloud Messaging (FCM HTTP v1) for the native Capacitor app. Both are stored
// per device under push-subscriptions/{uid}: web subscriptions in
// `subscriptions`, native tokens in `tokens`.

import webpush from 'web-push';
import jwt from 'jsonwebtoken';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
// Already public in the Angular bundle:
const FIREBASE_API_KEY = 'AIzaSyDIIW0YmNtS0WMcSyQa8l5ntv89C7SWlUo';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FCM_SEND_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@musicwishlist.app';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  } catch (err) {
    console.error('[push] Failed to configure VAPID:', err.message);
  }
} else {
  console.warn('[push] Missing VAPID keys — web push disabled');
}

async function getUserFromToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) throw new Error('Token verification failed');
  const { users } = await res.json();
  if (!users?.[0]) throw new Error('User not found');
  return { uid: users[0].localId, email: users[0].email ?? '' };
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(val).map(([k, v]) => [k, toFirestoreValue(v)])
        ),
      },
    };
  }
  return { stringValue: String(val) };
}

function fromFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) obj[k] = v.doubleValue;
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.arrayValue !== undefined) {
      obj[k] = (v.arrayValue.values ?? []).map(fromValue);
    } else if (v.mapValue !== undefined) {
      obj[k] = fromFields(v.mapValue.fields ?? {});
    } else if (v.nullValue !== null && v.nullValue !== undefined) obj[k] = null;
  }
  return obj;
}

function fromValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values ?? []).map(fromValue);
  if (v.mapValue !== undefined) return fromFields(v.mapValue.fields ?? {});
  return null;
}

function splitRegistrations(fields) {
  const f = fields ?? {};
  let subscriptions = {};
  if (f.subscriptions) subscriptions = fromFields(f).subscriptions ?? {};
  else if (f.subscription) subscriptions = { legacy: fromFields(f).subscription };
  const tokens = f.tokens ? fromFields(f).tokens ?? {} : {};
  return { subscriptions, tokens };
}

async function readRegistrations(docUrl, authToken) {
  const res = await fetch(docUrl, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) return { subscriptions: {}, tokens: {} };
  const data = await res.json();
  return splitRegistrations(data.fields);
}

async function writeRegistrations(docUrl, authToken, { subscriptions, tokens }) {
  const fields = {
    subscriptions: toFirestoreValue(subscriptions),
    tokens: toFirestoreValue(tokens),
    updatedAt: { integerValue: String(Date.now()) },
  };
  const res = await fetch(docUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore PATCH failed: ${await res.text()}`);
}

async function getServiceAccountToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
  const privateKey = rawKey
    .replace(/\\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n');
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);

  try {
    const assertion = jwt.sign(
      {
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      },
      privateKey,
      { algorithm: 'RS256' },
    );

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!res.ok) {
      console.error('[push] OAuth2 token error:', await res.text());
      return null;
    }
    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.error('[push] JWT signing error:', err.message);
    return null;
  }
}

function toDataStrings(data) {
  const out = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

async function sendFcm(accessToken, deviceToken, notification, data) {
  const res = await fetch(FCM_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification,
        data: toDataStrings(data),
        android: { priority: 'high' },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const status = body?.error?.status ?? String(res.status);
    const err = new Error(`FCM send failed: ${status}`);
    err.statusCode = res.status;
    err.fcmStatus = status;
    throw err;
  }
}

function isStaleFcmError(err) {
  return (
    err?.statusCode === 404 ||
    err?.fcmStatus === 'UNREGISTERED' ||
    err?.fcmStatus === 'NOT_FOUND'
  );
}

async function getDocAdmin(path, accessToken) {
  const r = await fetch(`${FIRESTORE_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (r.status === 404) return null;
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Firestore admin get ${path} error ${r.status}: ${body}`);
  }
  const data = await r.json();
  return { id: data.name.split('/').pop(), fields: data.fields };
}

async function deleteDocAdmin(path, accessToken) {
  const r = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (r.status !== 404 && !r.ok) {
    const body = await r.text();
    throw new Error(`Firestore admin delete ${path} error ${r.status}: ${body}`);
  }
}

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, subscription } = req.body ?? {};
  if (!['subscribe', 'unsubscribe', 'test', 'notify-downloaded'].includes(action)) {
    return res.status(400).json({ error: 'Missing or invalid action' });
  }

  const idToken = authHeader.slice(7);

  try {
    const { uid, email } = await getUserFromToken(idToken);
    const docUrl = `${FIRESTORE_BASE}/push-subscriptions/${uid}`;

    if (action === 'subscribe') {
      const { clientId, token } = req.body ?? {};
      if (!clientId) {
        return res.status(400).json({ error: 'Missing clientId' });
      }
      if (!token && !subscription?.endpoint) {
        return res.status(400).json({ error: 'Missing subscription or token' });
      }

      const registrations = await readRegistrations(docUrl, idToken);
      if (token) {
        registrations.tokens[clientId] = {
          token,
          platform: 'native',
          updatedAt: Date.now(),
        };
      } else {
        registrations.subscriptions[clientId] = subscription;
      }
      await writeRegistrations(docUrl, idToken, registrations);
      console.log(`[push] Subscribed ${token ? 'native' : 'web'} device ${clientId} for user ${uid}`);

    } else if (action === 'unsubscribe') {
      const { clientId } = req.body ?? {};
      if (!clientId) {
        return res.status(400).json({ error: 'Missing clientId' });
      }

      const registrations = await readRegistrations(docUrl, idToken);
      delete registrations.subscriptions[clientId];
      delete registrations.tokens[clientId];

      if (
        Object.keys(registrations.subscriptions).length === 0 &&
        Object.keys(registrations.tokens).length === 0
      ) {
        await fetch(docUrl, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${idToken}` },
        });
      } else {
        await writeRegistrations(docUrl, idToken, registrations);
      }

    } else if (action === 'test') {
      // Sends a test notification to the caller's own devices. Unlike
      // notify-downloaded, it only touches the caller's own registrations and
      // needs a service-account token only for the native (FCM) transport.
      const registrations = await readRegistrations(docUrl, idToken);
      const { subscriptions, tokens } = registrations;
      if (
        Object.keys(subscriptions).length === 0 &&
        Object.keys(tokens).length === 0
      ) {
        return res.status(404).json({ error: 'No push registration found' });
      }

      let sent = 0;
      const failed = [];

      for (const [id, subData] of Object.entries(subscriptions)) {
        try {
          await webpush.sendNotification(subData, JSON.stringify({ type: 'test' }));
          sent++;
        } catch (err) {
          console.error(`[push] Test send to device ${id} error: ${err.statusCode} ${err.message}`);
          failed.push(id);
        }
      }

      const tokenEntries = Object.entries(tokens);
      if (tokenEntries.length > 0) {
        const accessToken = await getServiceAccountToken();
        if (!accessToken) {
          console.warn('[push] No access token — skipping native test push');
          tokenEntries.forEach(([id]) => failed.push(id));
        } else {
          for (const [id, entry] of tokenEntries) {
            try {
              await sendFcm(
                accessToken,
                entry.token,
                {
                  title: '✅ Notificación de prueba',
                  body: 'Las notificaciones funcionan en este dispositivo',
                },
                { url: '/profile' },
              );
              sent++;
            } catch (err) {
              console.error(`[push] Test FCM send to device ${id} error: ${err.fcmStatus ?? err.message}`);
              failed.push(id);
            }
          }
        }
      }

      console.log(`[push] Test notification for ${uid}: sent=${sent} failed=${failed.length}`);
      return res.status(200).json({ ok: true, sent, failed: failed.length });

    } else if (action === 'notify-downloaded') {
      const { ownerUid, downloadedBy, item } = req.body ?? {};
      if (!ownerUid || !downloadedBy || !item?.name) {
        return res.status(400).json({ error: 'Missing ownerUid, downloadedBy, or item.name' });
      }

      // Only a recipient the owner explicitly shared their wishlist with may
      // trigger a notification for that owner. The share doc id is derived
      // from the owner uid and the caller's normalized email, and Firestore
      // rules only allow the recipient to read it.
      const encodedEmail = (email || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      const shareId = `${ownerUid}_${encodedEmail}`;
      const shareRes = await fetch(
        `${FIRESTORE_BASE}/wishlist-shares/${shareId}`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );
      if (!shareRes.ok) {
        return res
          .status(403)
          .json({ error: 'Not authorized to notify this user' });
      }

      const token = await getServiceAccountToken();
      if (!token) {
        console.warn('[push] No access token — skipping push');
        return res.status(200).json({ ok: true, skipped: 'no access token' });
      }

      const subDoc = await getDocAdmin(`push-subscriptions/${ownerUid}`, token);
      if (!subDoc) {
        console.log(`[push] No push registrations for owner ${ownerUid}`);
        return res.status(200).json({ ok: true, skipped: 'no registrations' });
      }

      const { subscriptions, tokens } = splitRegistrations(subDoc.fields);
      const subEntries = Object.entries(subscriptions);
      const tokenEntries = Object.entries(tokens);
      console.log(`[push] Found ${subEntries.length} web and ${tokenEntries.length} native registration(s) for owner ${ownerUid}`);
      if (subEntries.length === 0 && tokenEntries.length === 0) {
        return res.status(200).json({ ok: true, skipped: 'no registrations' });
      }

      const payload = JSON.stringify({
        type: 'downloaded',
        downloadedBy,
        itemName: item.name,
        itemArtist: item.artist || '',
        coverUrl: item.coverUrl || '',
      });

      const staleSubIds = [];
      const staleTokenIds = [];

      for (const [id, subData] of subEntries) {
        try {
          await webpush.sendNotification(subData, payload);
          console.log(`[push] Downloaded notification sent to web device ${id} of owner ${ownerUid}`);
        } catch (err) {
          console.error(`[push] Send to web device ${id} error: ${err.statusCode} ${err.message}`);
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleSubIds.push(id);
          }
        }
      }

      for (const [id, entry] of tokenEntries) {
        try {
          await sendFcm(
            token,
            entry.token,
            {
              title: `¡Ya tienes listo ${item.name} de ${item.artist || ''}!`.replace(/\s+!/, '!'),
              body: `Dale las gracias a ${downloadedBy} 😉`,
            },
            { url: '/?tab=wishlist&wishlistTab=downloaded' },
          );
          console.log(`[push] Downloaded notification sent to native device ${id} of owner ${ownerUid}`);
        } catch (err) {
          console.error(`[push] Send to native device ${id} error: ${err.fcmStatus ?? err.message}`);
          if (isStaleFcmError(err)) staleTokenIds.push(id);
        }
      }

      const remainingSubs = { ...subscriptions };
      const remainingTokens = { ...tokens };
      staleSubIds.forEach((id) => delete remainingSubs[id]);
      staleTokenIds.forEach((id) => delete remainingTokens[id]);

      if (staleSubIds.length > 0 || staleTokenIds.length > 0) {
        if (
          Object.keys(remainingSubs).length === 0 &&
          Object.keys(remainingTokens).length === 0
        ) {
          await deleteDocAdmin(`push-subscriptions/${ownerUid}`, token);
        } else {
          await fetch(`${FIRESTORE_BASE}/push-subscriptions/${ownerUid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              fields: {
                subscriptions: toFirestoreValue(remainingSubs),
                tokens: toFirestoreValue(remainingTokens),
              },
            }),
          });
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    const msg = error.message ?? String(error);
    console.error('push error:', msg);
    return res.status(500).json({ error: msg });
  }
};
