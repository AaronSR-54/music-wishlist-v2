import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  clearYoutubeCache,
  mapChannel,
  mapPlaylist,
  mapSearchItem,
  youtubeAdapter,
} from '../../lib/providers/youtube.js';

function useFetch(routes) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    const value = String(url);
    calls.push(value);
    const route = Object.entries(routes).find(([pattern]) => value.includes(pattern));
    if (!route) {
      return { ok: false, status: 404, text: async () => 'not found' };
    }
    return { ok: true, status: 200, json: async () => route[1] };
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

const trackSnippet = {
  title: 'Daft Punk - One More Time (Official Video)',
  channelTitle: 'Daft Punk',
  channelId: 'UC_kRDKYrUlrbtrSiyu5Tflg',
  publishedAt: '2026-01-15T10:00:00Z',
  thumbnails: { high: { url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' } },
};

beforeEach(() => {
  clearYoutubeCache();
  process.env.YOUTUBE_API_KEY = 'test-key';
});

test('maps a YouTube search result to a link-only track with artist and duration', () => {
  const item = mapSearchItem(
    { id: { videoId: 'abc' }, snippet: trackSnippet },
    { contentDetails: { duration: 'PT5M22S' } },
  );

  assert.equal(item.id, 'youtube:abc');
  assert.equal(item.provider, 'youtube');
  assert.equal(item.type, 'track');
  assert.equal(item.name, 'One More Time');
  assert.deepEqual(item.artists, ['Daft Punk']);
  assert.equal(item.artistId, 'youtube:UC_kRDKYrUlrbtrSiyu5Tflg');
  assert.equal(item.uri, 'https://www.youtube.com/watch?v=abc');
  assert.equal(item.duration, 322);
  assert.equal(item.previewUrl, undefined);
  assert.equal(item.albumId, undefined);
});

test('cleans official visualizer suffixes', () => {
  const item = mapSearchItem({
    id: { videoId: 'x' },
    snippet: {
      title: 'Daft Punk - Make Love (Official Visualizer)',
      channelTitle: 'Daft Punk',
      channelId: 'UC1',
    },
  });

  assert.equal(item.name, 'Make Love');
});

test('searchTracks requests music videos and adds batched durations', async () => {
  const fetchMock = useFetch({
    '/videos?part=contentDetails&id=abc': {
      items: [{ id: 'abc', contentDetails: { duration: 'PT3M5S' } }],
    },
    '/search?part=snippet&type=video': {
      items: [
        { id: { videoId: 'abc' }, snippet: trackSnippet },
        { id: { channelId: 'UC1' }, snippet: { title: 'Ignore me' } },
      ],
    },
  });

  try {
    const items = await youtubeAdapter.searchTracks('one more time', 10);
    assert.equal(items.length, 1);
    assert.equal(items[0].duration, 185);
    assert.match(fetchMock.calls[0], /videoCategoryId=10/);
    assert.match(fetchMock.calls[0], /key=test-key/);
  } finally {
    fetchMock.restore();
  }
});

test('mapPlaylist infers single, EP and album from the item count', () => {
  const base = {
    id: 'PL1',
    snippet: { title: 'Release', channelTitle: 'Artist', channelId: 'UC1' },
  };

  assert.equal(
    mapPlaylist({ ...base, contentDetails: { itemCount: 1 } }).type,
    'single',
  );
  assert.equal(
    mapPlaylist({ ...base, contentDetails: { itemCount: 5 } }).type,
    'ep',
  );
  assert.equal(
    mapPlaylist({ ...base, contentDetails: { itemCount: 13 } }).type,
    'album',
  );
  assert.equal(
    mapPlaylist({
      ...base,
      id: 'PL2',
      snippet: { ...base.snippet, title: 'Name - EP' },
      contentDetails: { itemCount: 8 },
    }).type,
    'ep',
  );
});

test('mapPlaylist cleans official album playlist names', () => {
  const album = mapPlaylist({
    id: 'PL1',
    snippet: {
      title: 'Daft Punk - Daft Club (Official Album Playlist)',
      channelTitle: 'Daft Punk',
    },
    contentDetails: { itemCount: 14 },
  });
  assert.equal(album.name, 'Daft Club');

  const quoted = mapPlaylist({
    id: 'PL2',
    snippet: {
      title:
        "Daft Punk 'Random Access Memories (10th Anniversary Edition)' Album",
      channelTitle: 'DaftPunkVEVO',
    },
    contentDetails: { itemCount: 22 },
  });
  assert.equal(quoted.name, 'Random Access Memories (10th Anniversary Edition)');
});

test('searchAlbums keeps official releases and drops fan uploads', async () => {
  const fetchMock = useFetch({
    '/search?part=snippet&type=playlist': {
      items: [
        {
          id: { playlistId: 'PLofficial' },
          snippet: { title: 'Random Access Memories', channelTitle: 'DaftPunkVEVO' },
        },
        {
          id: { playlistId: 'PLfan' },
          snippet: {
            title: 'Random Access Memories (Full Album)',
            channelTitle: 'Monderino',
          },
        },
        {
          id: { playlistId: 'PLmix' },
          snippet: {
            title: 'Daft Punk - Mix Clips | Vevo Playlist',
            channelTitle: 'DaftPunkVEVO',
          },
        },
      ],
    },
    '/playlists?part=snippet,contentDetails': {
      items: [
        {
          id: 'PLofficial',
          snippet: {
            title: 'Random Access Memories',
            channelTitle: 'DaftPunkVEVO',
            channelId: 'UCKHFvArwRwQU2VbRjMpaVGw',
            publishedAt: '2013-05-17T00:00:00Z',
            thumbnails: { high: { url: 'cover' } },
          },
          contentDetails: { itemCount: 13 },
        },
        {
          id: 'PLfan',
          snippet: {
            title: 'Random Access Memories (Full Album)',
            channelTitle: 'Monderino',
          },
          contentDetails: { itemCount: 13 },
        },
        {
          id: 'PLmix',
          snippet: {
            title: 'Daft Punk - Mix Clips | Vevo Playlist',
            channelTitle: 'DaftPunkVEVO',
          },
          contentDetails: { itemCount: 9 },
        },
      ],
    },
  });

  try {
    const albums = await youtubeAdapter.searchAlbums(
      'Random Access Memories Daft Punk',
      10,
    );

    assert.equal(albums.length, 1);
    assert.equal(albums[0].id, 'youtube:PLofficial');
    assert.equal(albums[0].type, 'album');
    assert.equal(albums[0].trackCount, 13);
    assert.equal(albums[0].artistId, 'youtube:UCKHFvArwRwQU2VbRjMpaVGw');
    assert.equal(
      albums[0].uri,
      'https://www.youtube.com/playlist?list=PLofficial',
    );
  } finally {
    fetchMock.restore();
  }
});

test('getAlbumTracks returns ordered tracks with durations and clean titles', async () => {
  const fetchMock = useFetch({
    '/videos?part=snippet,contentDetails&id=': {
      items: [
        { id: 'v1', contentDetails: { duration: 'PT5M20S' } },
        { id: 'v2', contentDetails: { duration: 'PT3M32S' } },
      ],
    },
    '/playlistItems?part=snippet,contentDetails': {
      items: [
        {
          snippet: {
            position: 0,
            title: 'Daft Punk - One More Time (Official Audio)',
            videoOwnerChannelTitle: 'DaftPunkVEVO',
            videoOwnerChannelId: 'UC1',
          },
          contentDetails: { videoId: 'v1' },
        },
        {
          snippet: {
            position: 1,
            title: 'Daft Punk - Aerodynamic [HD]',
            videoOwnerChannelTitle: 'DaftPunkVEVO',
            videoOwnerChannelId: 'UC1',
          },
          contentDetails: { videoId: 'v2' },
        },
      ],
    },
  });

  try {
    const tracks = await youtubeAdapter.getAlbumTracks('PL1');

    assert.deepEqual(
      tracks.map((track) => track.title),
      ['One More Time', 'Aerodynamic'],
    );
    assert.deepEqual(
      tracks.map((track) => track.trackNumber),
      [1, 2],
    );
    assert.deepEqual(
      tracks.map((track) => track.duration),
      [320, 212],
    );
    // The playlist item id must never leak: links use the video id.
    assert.deepEqual(
      tracks.map((track) => track.externalId),
      ['v1', 'v2'],
    );
    assert.equal(tracks[0].artistId, 'youtube:UC1');
  } finally {
    fetchMock.restore();
  }
});

test('getAlbum maps the playlist into an album with its channel as artist', async () => {
  const fetchMock = useFetch({
    '/playlists?part=snippet,contentDetails': {
      items: [
        {
          id: 'PL1',
          snippet: {
            title: 'Discovery',
            channelTitle: 'Daft Punk - Topic',
            channelId: 'UC1',
            publishedAt: '2001-03-12T00:00:00Z',
          },
          contentDetails: { itemCount: 14 },
        },
      ],
    },
  });

  try {
    const album = await youtubeAdapter.getAlbum('PL1');

    assert.equal(album.id, 'youtube:PL1');
    assert.equal(album.name, 'Discovery');
    assert.equal(album.artist, 'Daft Punk');
    assert.equal(album.type, 'album');
    assert.equal(album.releaseDate, '2001-03-12');
    assert.equal(album.trackCount, 14);
  } finally {
    fetchMock.restore();
  }
});

test('getAlbum rejects a missing playlist', async () => {
  const fetchMock = useFetch({ '/playlists?part=snippet,contentDetails': { items: [] } });

  try {
    await assert.rejects(
      () => youtubeAdapter.getAlbum('missing'),
      (error) => error.code === 'not_found' && error.status === 404,
    );
  } finally {
    fetchMock.restore();
  }
});

test('mapChannel exposes the artist avatar, subscribers and channel link', () => {
  const artist = mapChannel({
    id: 'UC1',
    snippet: {
      title: 'Daft Punk - Topic',
      thumbnails: { high: { url: 'https://avatar' } },
    },
    statistics: { subscriberCount: '102000', hiddenSubscriberCount: false },
    brandingSettings: { image: { bannerExternalUrl: 'https://banner' } },
  });

  assert.equal(artist.id, 'youtube:UC1');
  assert.equal(artist.name, 'Daft Punk');
  assert.equal(artist.coverUrl, 'https://avatar');
  assert.equal(artist.fanCount, 102000);
  assert.equal(artist.uri, 'https://www.youtube.com/channel/UC1');
});

test('getArtistTopTracks sorts music uploads by views and drops other categories', async () => {
  const fetchMock = useFetch({
    '/channels?part=contentDetails': {
      items: [{ id: 'UC1', contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }],
    },
    '/videos?part=snippet,statistics,contentDetails': {
      items: [
        {
          id: 'v1',
          snippet: { ...trackSnippet, title: 'Daft Punk - Low', categoryId: '10' },
          statistics: { viewCount: '10' },
          contentDetails: { duration: 'PT1M' },
        },
        {
          id: 'v2',
          snippet: { ...trackSnippet, title: 'Daft Punk - High', categoryId: '10' },
          statistics: { viewCount: '90' },
          contentDetails: { duration: 'PT2M' },
        },
        {
          id: 'v3',
          snippet: { ...trackSnippet, title: 'Trailer', categoryId: '24' },
          statistics: { viewCount: '9999' },
          contentDetails: { duration: 'PT1M' },
        },
      ],
    },
    '/playlistItems?part=snippet,contentDetails': {
      items: [
        { snippet: { position: 0 }, contentDetails: { videoId: 'v1' } },
        { snippet: { position: 1 }, contentDetails: { videoId: 'v2' } },
        { snippet: { position: 2 }, contentDetails: { videoId: 'v3' } },
      ],
    },
  });

  try {
    const tracks = await youtubeAdapter.getArtistTopTracks('UC1', 10);

    assert.deepEqual(
      tracks.map((track) => track.externalId),
      ['v2', 'v1'],
    );
    assert.equal(tracks[0].artistId, 'youtube:UC1');
  } finally {
    fetchMock.restore();
  }
});

test('getArtistAlbums filters compilations and video playlists', async () => {
  const fetchMock = useFetch({
    '/search?part=snippet&type=playlist': {
      items: [
        { id: { playlistId: 'PLalbum' } },
        { id: { playlistId: 'PLvideos' } },
        { id: { playlistId: 'PLbest' } },
      ],
    },
    '/playlists?part=snippet,contentDetails': {
      items: [
        {
          id: 'PLalbum',
          snippet: {
            title: 'Daft Punk - Homework (Full Album)',
            channelTitle: 'Daft Punk',
            channelId: 'UC1',
            publishedAt: '1997-01-20T00:00:00Z',
          },
          contentDetails: { itemCount: 16 },
        },
        {
          id: 'PLvideos',
          snippet: { title: 'Daft Punk - Official Videos', channelTitle: 'Daft Punk' },
          contentDetails: { itemCount: 12 },
        },
        {
          id: 'PLbest',
          snippet: { title: 'Daft Punk Essentials', channelTitle: 'Daft Punk' },
          contentDetails: { itemCount: 20 },
        },
      ],
    },
  });

  try {
    const albums = await youtubeAdapter.getArtistAlbums('UC1', 50);

    assert.equal(albums.length, 1);
    assert.equal(albums[0].id, 'youtube:PLalbum');
    assert.equal(albums[0].type, 'album');
  } finally {
    fetchMock.restore();
  }
});

test('getTrack returns the video link, duration and no preview', async () => {
  const fetchMock = useFetch({
    '/videos?part=snippet,contentDetails&id=v1': {
      items: [
        {
          id: 'v1',
          snippet: trackSnippet,
          contentDetails: { duration: 'PT5M22S' },
        },
      ],
    },
  });

  try {
    const track = await youtubeAdapter.getTrack('v1');
    assert.equal(track.id, 'youtube:v1');
    assert.equal(track.uri, 'https://www.youtube.com/watch?v=v1');
    assert.equal(track.duration, 322);
    assert.equal(track.previewUrl, undefined);
  } finally {
    fetchMock.restore();
  }
});

test('unconfigured YouTube fails with 503', async () => {
  delete process.env.YOUTUBE_API_KEY;
  await assert.rejects(
    () => youtubeAdapter.searchTracks('x', 10),
    (error) => error.status === 503 && error.code === 'provider_unavailable',
  );
});
