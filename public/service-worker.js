const CACHE_PREFIX = 'music-wishlist';
const BADGE_VERSION = 2;
const OFFLINE_URL = '/index.html';
const STATIC_ASSETS = ['/manifest.json', `/badge.png?v=${BADGE_VERSION}`];

let CACHE_NAME = `${CACHE_PREFIX}-v2`;

async function resolveCacheName() {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (res.ok) {
      const { version } = await res.json();
      if (version) CACHE_NAME = `${CACHE_PREFIX}-${version}`;
    }
  } catch {
    // Keep fallback cache name when offline.
  }
  return CACHE_NAME;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await resolveCacheName();
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([...STATIC_ASSETS, OFFLINE_URL]).catch(() => {
        console.log('Cache assets failed');
      });
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(
        (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
      );
      await Promise.all(oldCaches.map((name) => caches.delete(name)));
      await self.clients.claim();

      if (oldCaches.length > 0) {
        const clientList = await self.clients.matchAll({ type: 'window' });
        clientList.forEach((client) =>
          client.postMessage({ type: 'NEW_VERSION_AVAILABLE' }),
        );
      }
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  // Never cache the build version: the app reads it to decide which
  // service worker script to register.
  if (url.pathname === '/version.json') return;

  // Document navigations: network-first so a fresh index.html is never
  // pinned to stale hashed bundles. Fall back to the cached shell offline.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(OFFLINE_URL, copy))
            .catch(() => {});
          return response;
        })
        .catch(() =>
          caches
            .match(OFFLINE_URL)
            .then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  // Static assets: cache-first with background revalidation.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    ),
  );
});

const RELEASE_EMOJI = { Álbum: '💿', EP: '🎧', Canción: '🎵' };

function parsePushData(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    try {
      return { title: event.data.text() };
    } catch {
      return null;
    }
  }
}

self.addEventListener('push', (event) => {
  const data = parsePushData(event);
  if (!data) return;

  if (data.type === 'downloaded') {
    event.waitUntil(
      self.registration.showNotification(
        `¡Ya tienes listo ${data.itemName} de ${data.itemArtist}!`,
        {
          body: `Dale las gracias a ${data.downloadedBy} 😉`,
          icon: data.coverUrl,
          badge: `/badge.png?v=${BADGE_VERSION}`,
          data: { url: '/?tab=wishlist&wishlistTab=downloaded' },
        },
      ),
    );
    return;
  }

  const emoji = RELEASE_EMOJI[data.releaseType] ?? '🎵';
  event.waitUntil(
    self.registration.showNotification(`${emoji} Nuevo ${data.releaseType} de ${data.artist}`, {
      body: data.title,
      icon: data.coverUrl,
      image: data.coverUrl,
      badge: `/badge.png?v=${BADGE_VERSION}`,
      data: { albumId: data.albumId },
      actions: [
        { action: 'add', title: '+ Wishlist' },
        { action: 'view', title: 'Ver release' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data ?? {};
  const { albumId, url } = data;

  if (url) {
    event.waitUntil(openOrFocus(url));
    return;
  }

  const targetUrl =
    event.action === 'add'
      ? `/album/${albumId}?add=true`
      : `/album/${albumId}`;
  event.waitUntil(openOrFocus(targetUrl));
});

async function openOrFocus(targetUrl) {
  const list = await self.clients.matchAll({ type: 'window' });
  for (const client of list) {
    if ('focus' in client) {
      client.navigate(targetUrl);
      return client.focus();
    }
  }
  return self.clients.openWindow(targetUrl);
}
