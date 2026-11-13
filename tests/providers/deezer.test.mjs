import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deezerAdapter, mapAlbum, mapArtist, mapTrack } from '../../lib/providers/deezer.js';

test('maps a Deezer track to a provider-scoped item', () => {
  const item = mapTrack({
    id: 1,
    title: 'Song',
    duration: 200,
    link: 'https://www.deezer.com/track/1',
    preview: 'https://cdns-preview.dzcdn.net/1.mp3',
    artist: { id: 2, name: 'Artist' },
    album: { id: 3, title: 'Album', cover_big: 'https://cover/1' },
  });

  assert.equal(item.id, 'deezer:1');
  assert.equal(item.provider, 'deezer');
  assert.equal(item.externalId, '1');
  assert.deepEqual(item.artists, ['Artist']);
  assert.equal(item.artistId, 'deezer:2');
  assert.equal(item.albumId, 'deezer:3');
  assert.equal(item.previewUrl, 'https://cdns-preview.dzcdn.net/1.mp3');
  assert.equal(item.type, 'track');
});

test('falls back to the medium cover and omits an empty preview', () => {
  const item = mapTrack({
    id: 1,
    title: 'Song',
    link: '',
    artist: { id: 2, name: 'Artist' },
    album: { id: 3, title: 'Album', cover_medium: 'https://cover/medium' },
  });

  assert.equal(item.coverUrl, 'https://cover/medium');
  assert.equal(item.previewUrl, undefined);
});

test('maps Deezer record types', () => {
  assert.equal(mapAlbum({ id: 1, title: 'A', record_type: 'single' }).type, 'single');
  assert.equal(mapAlbum({ id: 1, title: 'A', record_type: 'ep' }).type, 'ep');
  assert.equal(mapAlbum({ id: 1, title: 'A', record_type: 'album' }).type, 'album');
  assert.equal(mapAlbum({ id: 1, title: 'A' }).type, 'album');
});

test('keeps full Deezer release dates', () => {
  assert.equal(
    mapAlbum({ id: 1, title: 'A', release_date: '2026-11-13' }).releaseDate,
    '2026-11-13',
  );
});

test('maps Deezer artists with fan and album counts', () => {
  const artist = mapArtist({
    id: 7,
    name: 'Artist',
    picture_big: 'https://img/big',
    link: 'https://www.deezer.com/artist/7',
    nb_fan: 10,
    nb_album: 4,
  });

  assert.equal(artist.id, 'deezer:7');
  assert.equal(artist.type, 'artist');
  assert.equal(artist.fanCount, 10);
  assert.equal(artist.albumCount, 4);
  assert.equal(artist.coverUrl, 'https://img/big');
});

test('searchTracks maps the Deezer data array', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: [
        {
          id: 5,
          title: 'Found',
          artist: { id: 6, name: 'Someone' },
          album: { id: 7, title: 'Record', cover_big: 'https://cover' },
        },
      ],
    }),
  });

  try {
    const items = await deezerAdapter.searchTracks('found', 10);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, 'deezer:5');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an upstream Deezer error becomes a ProviderError', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ error: { code: 4, message: 'Quota limit exceeded' } }),
  });

  try {
    await assert.rejects(
      () => deezerAdapter.searchTracks('x', 10),
      (error) => error.code === 'upstream_error',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
