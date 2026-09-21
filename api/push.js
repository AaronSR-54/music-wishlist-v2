// firebase-admin NOT used here — avoids gRPC/OpenSSL issues on Vercel.
// User's own ID token authenticates directly against Firestore REST API.
// Security rules enforce userId isolation.

import webpush from 'web-push';
import jwt from 'jsonwebtoken';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
// Already public in the Angular bundle:
const FIREBASE_API_KEY = 'AIzaSyDIIW0YmNtS0WMcSyQa8l5ntv89C7SWlUo';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
  console.warn('[push] Missing VAPID keys — push notifications disabled');
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
    console.error('[push] Key preview:', JSON.stringify(rawKey.slice(0, 60)));
    return null;
  }
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
  if (!['subscribe', 'unsubscribe', 'notify-downloaded'].includes(action)) {
    return res.status(400).json({ error: 'Missing or invalid action' });
  }

  const idToken = authHeader.slice(7);

  try {
    const { uid, email } = await getUserFromToken(idToken);
    const docUrl = `${FIRESTORE_BASE}/push-subscriptions/${uid}`;

    if (action === 'subscribe') {
      if (!subscription?.endpoint) {
        return res.status(400).json({ error: 'Missing subscription' });
      }
      const { clientId } = req.body ?? {};
      if (!clientId) {
        return res.status(400).json({ error: 'Missing clientId' });
      }

      let subs = {};
      const existingRes = await fetch(docUrl, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (existingRes.ok) {
        const data = await existingRes.json();
        const f = data.fields;
        if (f?.subscriptions) {
          subs = fromFields(f).subscriptions ?? {};
        } else if (f?.subscription) {
          subs = { legacy: fromFields(f).subscription };
        }
      }
      subs[clientId] = subscription;

      const r = await fetch(docUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          fields: {
            subscriptions: toFirestoreValue(subs),
            updatedAt: { integerValue: String(Date.now()) },
          },
        }),
      });
      if (!r.ok) throw new Error(`Firestore PATCH failed: ${await r.text()}`);
      console.log(`[push] Subscribed device ${clientId} for user ${uid}`);

    } else if (action === 'unsubscribe') {
      const { clientId } = req.body ?? {};
      if (!clientId) {
        return res.status(400).json({ error: 'Missing clientId' });
      }

      const existingRes = await fetch(docUrl, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (existingRes.ok) {
        const data = await existingRes.json();
        const subs = data.fields?.subscriptions
          ? (fromFields(data.fields).subscriptions ?? {})
          : {};
        delete subs[clientId];

        if (Object.keys(subs).length === 0) {
          await fetch(docUrl, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${idToken}` },
          });
        } else {
          await fetch(docUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              fields: {
                subscriptions: toFirestoreValue(subs),
                updatedAt: { integerValue: String(Date.now()) },
              },
            }),
          });
        }
      }

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
        console.log(`[push] No push subscriptions for owner ${ownerUid}`);
        return res.status(200).json({ ok: true, skipped: 'no subscriptions' });
      }

      const f = subDoc.fields;
      let subs = {};
      if (f?.subscriptions) {
        subs = fromFields(f).subscriptions ?? {};
      } else if (f?.subscription) {
        subs = { legacy: fromFields(f).subscription };
      }
      const entries = Object.entries(subs);
      console.log(`[push] Found ${entries.length} subscription(s) for owner ${ownerUid}: [${entries.map(([id]) => id).join(', ')}]`);
      if (entries.length === 0) {
        return res.status(200).json({ ok: true, skipped: 'no subscriptions' });
      }

      const payload = JSON.stringify({
        type: 'downloaded',
        downloadedBy,
        itemName: item.name,
        itemArtist: item.artist || '',
        coverUrl: item.coverUrl || '',
      });

      const staleIds = [];
      for (const [id, subData] of entries) {
        try {
          await webpush.sendNotification(subData, payload);
          console.log(`[push] Downloaded notification sent to device ${id} of owner ${ownerUid}`);
        } catch (err) {
          console.error(`[push] Send to device ${id} error: ${err.statusCode} ${err.message}`);
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleIds.push(id);
          }
        }
      }

      if (staleIds.length > 0) {
        for (const id of staleIds) {
          delete subs[id];
        }
        if (Object.keys(subs).length === 0) {
          await deleteDocAdmin(`push-subscriptions/${ownerUid}`, token);
        } else {
          await fetch(`${FIRESTORE_BASE}/push-subscriptions/${ownerUid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              fields: { subscriptions: toFirestoreValue(subs) },
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
