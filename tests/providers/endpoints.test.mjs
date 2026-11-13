import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createAlbumHandler,
  createArtistAlbumsHandler,
  createSearchHandler,
} from '../../lib/providers/handlers.js';
import { createPreviewHandler } from '../../lib/providers/preview-handler.js';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
  };
}

async function call(handler, query) {
  const res = mockRes();
  await handler({ query }, res);
  return res;
}

const deezerTrackPayload = {
  data: [
    {
      id: 1,
      title: 'Song',
      link: 'https://www.deezer.com/track/1',
      artist: { id: 2, name: 'Artist' },
      album: { id: 3, title: 'Album', cover_big: 'https://cover' },
    },
  ],
};

test('providers metadata lists only Deezer and YouTube', async () => {
  const res = await call(createSearchHandler(), { providers: '1' });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.providers.length, 2);
  assert.equal(res.body.providers.find((p) => p.id === 'deezer').available, true);
  assert.equal(res.body.providers.find((p) => p.id === 'youtube').available, false);
  assert.equal(res.body.providers.find((p) => p.id === 'spotify'), undefined);
  assert.equal(res.body.providers.find((p) => p.id === 'itunes'), undefined);
});

test('search without format returns the legacy Deezer envelope', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => deezerTrackPayload });

  try {
    const res = await call(createSearchHandler(), { q: 'song' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data[0].title, 'Song');
    assert.equal(res.body.data[0].id, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('search with format=neutral returns provider-scoped items', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => deezerTrackPayload });

  try {
    const res = await call(createSearchHandler(), { q: 'song', format: 'neutral' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.provider, 'deezer');
    assert.equal(res.body.data[0].id, 'deezer:1');
    assert.equal(res.body.data[0].provider, 'deezer');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unknown providers return 400', async () => {
  const res = await call(createSearchHandler(), { q: 'song', provider: 'tidal' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'provider_unknown');
});

test('unconfigured providers return 503', async () => {
  const previousKey = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;

  try {
    const res = await call(createSearchHandler(), { q: 'song', provider: 'youtube' });
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'provider_unavailable');
  } finally {
    if (previousKey !== undefined) process.env.YOUTUBE_API_KEY = previousKey;
  }
});

test('album neutral resolves a namespaced id', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      id: 3,
      title: 'Album',
      record_type: 'album',
      release_date: '2026-01-01',
      artist: { id: 2, name: 'Artist' },
      cover_big: 'https://cover',
    }),
  });

  try {
    const res = await call(createAlbumHandler(), { id: 'deezer:3', format: 'neutral' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.id, 'deezer:3');
    assert.equal(res.body.data.releaseDate, '2026-01-01');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('artist albums keeps the 1-100 limit clamp on the legacy path', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = null;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return { ok: true, json: async () => ({ data: [] }) };
  };

  try {
    await call(createArtistAlbumsHandler(), { id: '7', limit: '999' });
    assert.match(requestedUrl, /limit=100$/);

    await call(createArtistAlbumsHandler(), { id: '7', limit: '0' });
    assert.match(requestedUrl, /limit=1$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('preview rejects non-allowlisted hosts', async () => {
  const res = mockRes();
  await createPreviewHandler()(
    { query: { url: 'https://evil.example/audio.mp3' } },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'URL not allowed');
});

test('preview proxies an allowlisted Deezer URL', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => 'audio/mpeg' },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  });

  try {
    const res = mockRes();
    res.end = (body) => {
      res.buffer = body;
    };
    await createPreviewHandler()(
      { query: { url: 'https://cdns-preview.dzcdn.net/audio.mp3' } },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'audio/mpeg');
    assert.deepEqual([...res.buffer], [1, 2, 3]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
