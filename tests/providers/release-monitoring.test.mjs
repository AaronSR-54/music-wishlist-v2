import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  artistCacheKey,
  expandFavoriteArtists,
  groupFavoritesByProvider,
  isWithinWindow,
  selectNewReleases,
  toLegacyAlbum,
} from '../../lib/providers/release-monitoring.js';

test('groups favorites by provider and defaults legacy ids to Deezer', () => {
  const groups = groupFavoritesByProvider([
    { artistId: '27', name: 'Daft Punk' },
    { artistId: 'deezer:28', name: 'Deezer artist' },
    { artistId: 'youtube:UCabc', name: 'YouTube channel' },
  ]);

  assert.equal(groups.deezer.length, 2);
  assert.equal(groups.youtube.length, 1);
});

test('keeps legacy Deezer cache keys and namespaces other providers', () => {
  assert.equal(
    artistCacheKey('27', 'cron', 'uid'),
    'artist-releases-cache/cron_uid_27',
  );
  assert.equal(
    artistCacheKey('youtube:UCabc', 'cron', 'uid'),
    'artist-releases-cache/cron_uid_youtube:UCabc',
  );
});

test('maps neutral albums to the release cache shape', () => {
  const album = toLegacyAlbum({
    id: 'youtube:PL1',
    externalId: 'PL1',
    provider: 'youtube',
    name: 'Album',
    type: 'single',
    coverUrl: 'https://cover',
    releaseDate: '2026-11-13',
  });

  assert.equal(album.id, 'PL1');
  assert.equal(album.catalogId, 'youtube:PL1');
  assert.equal(album.provider, 'youtube');
  assert.equal(album.record_type, 'single');
  assert.equal(album.release_date, '2026-11-13');
});

test('expands a merged artist group for release monitoring', () => {
  const expanded = expandFavoriteArtists(
    [{ artistId: 'deezer:105607162', name: 'Iban' }],
    [
      {
        primaryArtistId: 'deezer:999',
        aliasArtistId: 'deezer:105607162',
        primaryName: 'Iban Real',
        aliasName: 'Iban Duplicado',
      },
    ],
  );

  assert.deepEqual(
    expanded.map((favorite) => favorite.artistId),
    ['deezer:999', 'deezer:105607162'],
  );
  assert.equal(expanded[0].name, 'Iban Real');
  assert.equal(expanded[1].name, 'Iban Duplicado');
});

test('dedupes favorites that belong to the same merged group', () => {
  const expanded = expandFavoriteArtists(
    [
      { artistId: 'deezer:1', name: 'Primary' },
      { artistId: 'deezer:2', name: 'Alias' },
      { artistId: 'deezer:3', name: 'Other' },
    ],
    [
      {
        primaryArtistId: 'deezer:1',
        aliasArtistId: 'deezer:2',
        primaryName: 'Primary',
        aliasName: 'Alias',
      },
    ],
  );

  assert.deepEqual(
    expanded.map((favorite) => favorite.artistId),
    ['deezer:1', 'deezer:2', 'deezer:3'],
  );
});

test('uses a two-day calendar window', () => {
  const now = new Date('2026-11-13T12:00:00Z');
  assert.equal(isWithinWindow('2026-11-13', 2, now), true);
  assert.equal(isWithinWindow('2026-11-12', 2, now), true);
  assert.equal(isWithinWindow('2026-11-11', 2, now), true);
  assert.equal(isWithinWindow('2026-11-10', 2, now), false);
  assert.equal(isWithinWindow('', 2, now), false);
});

test('filters already-notified releases by external id', () => {
  const now = new Date('2026-11-13T12:00:00Z');
  const albums = [
    { id: '1', title: 'New', release_date: '2026-11-13' },
    { id: '2', title: 'Notified', release_date: '2026-11-12' },
    { id: '3', title: 'Old', release_date: '2026-11-01' },
  ];

  const selected = selectNewReleases(albums, ['2'], 2, now);
  assert.deepEqual(selected.map((album) => album.id), ['1']);
});
