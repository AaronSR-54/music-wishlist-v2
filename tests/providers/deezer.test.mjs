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

test('getArtistAlbums fills an incomplete artist album list from the album search', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    if (String(url).includes('/artist/7201/albums')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              title: 'Known',
              record_type: 'album',
              release_date: '2010-01-01',
              artist: { id: 7201, name: 'SFDK' },
            },
          ],
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            title: 'Known',
            record_type: 'album',
            release_date: '2010-01-01',
            artist: { id: 7201, name: 'SFDK' },
          },
          {
            id: 2,
            title: 'Inkebrantable',
            record_type: 'album',
            release_date: '2023-03-10',
            artist: { id: 7201, name: 'SFDK' },
          },
          {
            id: 3,
            title: 'Someone else',
            record_type: 'album',
            release_date: '2024-01-01',
            artist: { id: 999, name: 'Other' },
          },
        ],
      }),
    };
  };

  try {
    const albums = await deezerAdapter.getArtistAlbums('7201', 100, {
      name: 'SFDK',
    });

    assert.equal(requested.length, 2);
    assert.match(requested[1], /search\/album\?q=artist%3A%22SFDK%22/);
    assert.deepEqual(
      albums.map((album) => album.name),
      ['Inkebrantable', 'Known'],
    );
    assert.equal(albums.find((album) => album.name === 'Inkebrantable').id, 'deezer:2');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getArtistAlbums skips the extra search without a name and when it fails', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            title: 'Only',
            record_type: 'album',
            artist: { id: 7201, name: 'SFDK' },
          },
        ],
      }),
    };
  };

  try {
    const withoutName = await deezerAdapter.getArtistAlbums('7201', 100);
    assert.equal(calls, 1);
    assert.equal(withoutName.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = async (url) => {
    if (String(url).includes('/search/album')) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    return {
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            title: 'Only',
            record_type: 'album',
            artist: { id: 7201, name: 'SFDK' },
          },
        ],
      }),
    };
  };

  try {
    const fallback = await deezerAdapter.getArtistAlbums('7201', 100, {
      name: 'SFDK',
    });
    assert.equal(fallback.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getArtistAlbums restores release dates so the merged discography is ordered', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];

  globalThis.fetch = async (url) => {
    const href = String(url);
    requested.push(href);

    if (href.includes('/artist/9001/albums')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 101,
              title: 'Endpoint album',
              record_type: 'album',
              release_date: '2010-01-01',
              artist: { id: 9001, name: 'Test' },
            },
          ],
        }),
      };
    }

    if (href.includes('/search/album')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 102,
              title: 'Newest',
              record_type: 'album',
              artist: { id: 9001, name: 'Test' },
            },
            {
              id: 103,
              title: 'Middle',
              record_type: 'album',
              artist: { id: 9001, name: 'Test' },
            },
          ],
        }),
      };
    }

    // Album detail lookups.
    const id = href.match(/\/album\/(\d+)/)?.[1];
    const dates = { 102: '2023-03-10', 103: '2015-05-05' };
    return {
      ok: true,
      json: async () => ({ id: Number(id), release_date: dates[id] }),
    };
  };

  try {
    const albums = await deezerAdapter.getArtistAlbums('9001', 100, {
      name: 'Test',
      dates: true,
    });

    assert.deepEqual(
      albums.map((album) => album.name),
      ['Newest', 'Middle', 'Endpoint album'],
    );
    assert.deepEqual(
      albums.map((album) => album.releaseDate),
      ['2023-03-10', '2015-05-05', '2010-01-01'],
    );
    // artist albums + search + only the two albums missing a date.
    assert.equal(requested.length, 4);
    assert.equal(albums.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getArtistAlbums keeps undated albums when a detail lookup fails', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/artist/9100/albums')) {
      return { ok: true, json: async () => ({ data: [] }) };
    }
    if (href.includes('/search/album')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 201,
              title: 'Undated',
              record_type: 'album',
              artist: { id: 9100, name: 'Broken' },
            },
          ],
        }),
      };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };

  try {
    const albums = await deezerAdapter.getArtistAlbums('9100', 100, {
      name: 'Broken',
      dates: true,
    });

    assert.equal(albums.length, 1);
    assert.equal(albums[0].name, 'Undated');
    assert.equal(albums[0].releaseDate, undefined);
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
