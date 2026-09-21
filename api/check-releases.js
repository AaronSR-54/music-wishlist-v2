// firebase-admin NOT used here — avoids gRPC/OpenSSL issues on Vercel.
// User's Firebase ID token used directly for Firestore REST API.
// Firestore security rule required:
//   match /artist-releases-cache/{document} { allow read, write: if request.auth != null; }

import webpush from 'web-push';
import jwt from 'jsonwebtoken';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
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
    console.error('[check-releases] Failed to configure VAPID:', err.message);
  }
} else {
  console.warn('[check-releases] Missing VAPID keys — push notifications disabled');
}

async function getServiceAccountToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
  const privateKey = rawKey
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
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
      console.error('[check-releases] OAuth2 token error:', await res.text());
      return null;
    }
    return (await res.json()).access_token;
  } catch (err) {
    console.error('[check-releases] JWT signing error:', err.message);
    return null;
  }
}

const RECORD_TYPE_MAP = {
  album: 'Álbum',
  ep: 'EP',
  single: 'Canción',
};

// ── Auth ──────────────────────────────────────────────────────

async function getUidFromToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!res.ok) throw new Error('Token verification failed');
  const { users } = await res.json();
  if (!users?.[0]) throw new Error('User not found');
  return users[0].localId;
}

// ── Firestore REST helpers ────────────────────────────────────

function toDoc(value) {
  const fields = Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, toValue(v)]),
  );
  return { fields };
}

function toValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toValue) } };
  if (typeof val === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(val).map(([k, v]) => [k, toValue(v)]),
        ),
      },
    };
  }
  return { stringValue: String(val) };
}

async function listWhere(collection, fieldPath, op, value, token) {
  const structuredQuery = {
    from: [{ collectionId: collection }],
    where: {
      fieldFilter: {
        field: { fieldPath },
        op,
        value: toValue(value),
      },
    },
  };
  const r = await fetch(
    `${FIRESTORE_BASE}:runQuery`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ structuredQuery }),
    },
  );
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Firestore query ${collection} error ${r.status}: ${body}`);
  }
  const results = await r.json();
  const docs = [];
  for (const item of results) {
    if (item.document) {
      docs.push({
        id: item.document.name.split('/').pop(),
        fields: item.document.fields,
      });
    }
  }
  return docs;
}

async function listCollection(collection, token) {
  const structuredQuery = {
    from: [{ collectionId: collection }],
  };
  const r = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Firestore list ${collection} error ${r.status}: ${body}`);
  }
  const results = await r.json();
  const docs = [];
  for (const item of results) {
    if (item.document) {
      docs.push({
        id: item.document.name.split('/').pop(),
        fields: item.document.fields,
      });
    }
  }
  return docs;
}

async function getDoc(path, token) {
  const r = await fetch(`${FIRESTORE_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 404) return null;
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Firestore get ${path} error ${r.status}: ${body}`);
  }
  const data = await r.json();
  return { id: data.name.split('/').pop(), fields: data.fields };
}

async function setDoc(path, data, token) {
  const r = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(toDoc(data)),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Firestore set ${path} error ${r.status}: ${body}`);
  }
  console.log(`[check-releases] setDoc success: ${path}`);
}

async function deleteDoc(path, token) {
  const r = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status !== 404 && !r.ok) {
    const body = await r.text();
    throw new Error(`Firestore delete ${path} error ${r.status}: ${body}`);
  }
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

// ── Deezer ────────────────────────────────────────────────────

const RELEASE_WINDOW_DAYS = Number(process.env.RELEASE_WINDOW_DAYS ?? 1);

async function fetchArtistAlbums(artistId) {
  const res = await fetch(`https://api.deezer.com/artist/${artistId}/albums?limit=50`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}

function isWithinWindow(releaseDateStr, days) {
  if (!releaseDateStr) return false;
  const releaseDate = new Date(releaseDateStr);
  if (isNaN(releaseDate.getTime())) return false;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return releaseDate >= cutoff;
}

// ── Runner ────────────────────────────────────────────────────

async function run(uid, idToken, clientId) {
  const subDoc = await getDoc(`push-subscriptions/${uid}`, idToken);
  if (!subDoc) {
    return { notified: 0, results: [], error: 'No push subscription found.' };
  }

  const f = subDoc.fields;
  const isMapFormat = !!f?.subscriptions;
  let subs = {};
  if (isMapFormat) {
    subs = fromFields(f).subscriptions ?? {};
  } else if (f?.subscription) {
    subs = { _legacy: fromFields(f).subscription };
  }
  const subEntries = Object.entries(subs);
  if (subEntries.length === 0) {
    return { notified: 0, results: [], error: 'No push subscription found.' };
  }

  const favDocs = await listWhere('favorite-artists', 'addedByUid', 'EQUAL', uid, idToken);
  if (!favDocs.length) {
    return { notified: 0, results: [], error: 'No favorite artists found.' };
  }

  const favorites = favDocs.map((d) => fromFields(d.fields));

  const newReleasesByArtist = {};
  for (const favorite of favorites) {
    const albums = await fetchArtistAlbums(favorite.artistId);
    if (!albums.length) {
      console.log(`[check-releases] No albums from Deezer for artist ${favorite.artistId}`);
      continue;
    }

    const cacheRef = `artist-releases-cache/${clientId}_${favorite.artistId}`;
    const cacheDoc = await getDoc(cacheRef, idToken);
    const notifiedIds = cacheDoc ? (cacheDoc.fields?.albumIds?.arrayValue?.values ?? []).map((v) => v.stringValue).filter(Boolean) : [];

    console.log(`[check-releases] artist=${favorite.name} cacheRef=${cacheRef} notifiedIds count=${notifiedIds.length} RELEASE_WINDOW_DAYS=${RELEASE_WINDOW_DAYS}`);

    const albumsToNotify = albums.filter((a) => {
      const isNew = isWithinWindow(a.release_date, RELEASE_WINDOW_DAYS);
      const alreadyNotified = notifiedIds.includes(String(a.id));
      console.log(`[check-releases]   album=${a.title} release_date=${a.release_date} isNew=${isNew} alreadyNotified=${alreadyNotified}`);
      return isNew && !alreadyNotified;
    });

    console.log(`[check-releases] albumsToNotify count: ${albumsToNotify.length}`);
    if (albumsToNotify.length > 0) {
      newReleasesByArtist[favorite.artistId] = albumsToNotify;
      const updatedNotifiedIds = [...new Set([...notifiedIds, ...albumsToNotify.map((a) => String(a.id))])];
      await setDoc(cacheRef, { albumIds: updatedNotifiedIds, checkedAt: Date.now() }, idToken);
    }
  }

  console.log(`[check-releases] newReleasesByArtist: ${JSON.stringify(Object.keys(newReleasesByArtist))}`);

  const results = [];
  let notified = 0;
  let didCleanup = false;

  for (const favorite of favorites) {
    const newAlbums = newReleasesByArtist[favorite.artistId];
    if (!newAlbums?.length) continue;

    console.log(`[check-releases] Sending ${newAlbums.length} notifications for ${favorite.name}`);

    const artistResults = { artist: favorite.name, artistId: favorite.artistId, albums: [] };

    for (const album of newAlbums) {
      const releaseType = RECORD_TYPE_MAP[album.record_type?.toLowerCase()] ?? 'Álbum';
      const coverUrl = album.cover_xl ?? album.cover_big ?? album.cover_medium ?? '';

      const payload = JSON.stringify({
        title: album.title,
        artist: favorite.name,
        releaseType,
        coverUrl,
        albumId: String(album.id),
      });

      const staleIds = [];
      let sentAny = false;
      for (const [id, subData] of subEntries) {
        try {
          await webpush.sendNotification(subData, payload);
          sentAny = true;
        } catch (err) {
          console.error(`[check-releases] Push error for ${album.title} (${id}): ${err.statusCode} ${err.message}`);
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleIds.push(id);
          }
        }
      }

      // Clean up stale subscriptions
      if (staleIds.length > 0) {
        didCleanup = true;
        for (const id of staleIds) {
          delete subs[id];
          const idx = subEntries.findIndex(([k]) => k === id);
          if (idx >= 0) subEntries.splice(idx, 1);
        }
      }

      if (sentAny) {
        notified++;
        artistResults.albums.push({ id: album.id, title: album.title, recordType: releaseType, sent: true });
      } else {
        artistResults.albums.push({ id: album.id, title: album.title, recordType: releaseType, sent: false, error: 'All subscriptions failed' });
      }
    }

    results.push(artistResults);
  }

  if (didCleanup) {
    const remaining = Object.keys(subs);
    if (remaining.length === 0) {
      await deleteDoc(`push-subscriptions/${uid}`, idToken);
    } else if (isMapFormat) {
      await setDoc(`push-subscriptions/${uid}`, { subscriptions: subs, updatedAt: Date.now() }, idToken);
    }
  }

  console.log(`[check-releases] Final: notified=${notified} resultsCount=${results.length}`);
  return { notified, results };
}

// ── Handler ───────────────────────────────────────────────────

export default async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.slice(7);

    // CRON_SECRET path — runs for every subscribed user using a service
    // account token, which bypasses Firestore security rules.
    if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) {
      const adminToken = await getServiceAccountToken();
      if (!adminToken) {
        return res
          .status(500)
          .json({ error: 'Service account not configured' });
      }

      const subs = await listCollection('push-subscriptions', adminToken);
      const results = [];
      for (const sub of subs) {
        try {
          results.push({
            uid: sub.id,
            ...(await run(sub.id, adminToken, 'cron')),
          });
        } catch (err) {
          console.error(`[check-releases] cron run failed for ${sub.id}:`, err);
          results.push({ uid: sub.id, error: err.message });
        }
      }
      return res.status(200).json({ users: results.length, results });
    }

    const uid = await getUidFromToken(token);
    const clientId = req.body?.clientId ?? 'unknown';
    const result = await run(uid, token, clientId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('check-releases error:', error);
    return res.status(500).json({ error: error.message ?? 'Internal server error' });
  }
};
