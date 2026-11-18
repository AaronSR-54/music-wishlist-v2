'use strict';

const {
  ProviderError,
  buildAlbum,
  buildAlbumTrack,
  buildArtist,
  buildItem,
  normalizeRecordType,
  omitUndefined,
  toCatalogId,
} = require('./contract.js');

const BASE = 'https://api.deezer.com';
const PROVIDER = 'deezer';

async function deezerFetch(path) {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    throw new ProviderError(
      'upstream_error',
      `Deezer request failed: ${response.status}`,
      response.status === 404 ? 404 : 502,
      { provider: PROVIDER },
    );
  }

  const data = await response.json();
  if (data?.error) {
    throw new ProviderError(
      'upstream_error',
      data.error.message ?? 'Deezer error',
      502,
      { provider: PROVIDER },
    );
  }
  return data;
}

function artistId(value) {
  return value ? toCatalogId(PROVIDER, value) : undefined;
}

function mapTrack(track) {
  return buildItem({
    provider: PROVIDER,
    externalId: track.id,
    name: track.title,
    artists: track.artist?.name ? [track.artist.name] : [],
    coverUrl: track.album?.cover_big ?? track.album?.cover_medium ?? '',
    type: 'track',
    uri: track.link ?? '',
    artistId: artistId(track.artist?.id),
    albumId: track.album?.id ? toCatalogId(PROVIDER, track.album.id) : undefined,
    albumName: track.album?.title,
    previewUrl: track.preview || undefined,
    duration: track.duration,
  });
}

function mapAlbum(album) {
  return buildAlbum({
    provider: PROVIDER,
    externalId: album.id,
    name: album.title,
    artists: album.artist?.name ? [album.artist.name] : [],
    artist: album.artist?.name ?? '',
    artistId: artistId(album.artist?.id),
    coverUrl: album.cover_big ?? album.cover_medium ?? '',
    type: normalizeRecordType(album.record_type),
    uri: album.link ?? '',
    releaseDate: album.release_date,
    trackCount: album.nb_tracks,
  });
}

function mapArtist(artist) {
  return buildArtist({
    provider: PROVIDER,
    externalId: artist.id,
    name: artist.name,
    coverUrl: artist.picture_big ?? artist.picture_medium ?? '',
    uri: artist.link ?? '',
    fanCount: artist.nb_fan,
    albumCount: artist.nb_album,
  });
}

function mapAlbumTrack(track, index) {
  return buildAlbumTrack({
    provider: PROVIDER,
    externalId: track.id,
    title: track.title,
    duration: track.duration ?? 0,
    trackNumber: index + 1,
    previewUrl: track.preview || undefined,
    artistId: artistId(track.artist?.id),
  });
}

function mapTrackPreview(track) {
  return omitUndefined({
    id: toCatalogId(PROVIDER, track.id),
    externalId: String(track.id),
    provider: PROVIDER,
    previewUrl: track.preview || undefined,
  });
}

const ARTIST_ALBUMS_SEARCH_LIMIT = 100;

function sanitizeArtistName(name) {
  return String(name ?? '')
    .replace(/["\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchArtistAlbums(artistId, name) {
  const term = sanitizeArtistName(name);
  if (!term) return [];

  try {
    const data = await deezerFetch(
      `/search/album?q=${encodeURIComponent(`artist:"${term}"`)}&limit=${ARTIST_ALBUMS_SEARCH_LIMIT}`,
    );
    return (data.data ?? [])
      .filter((album) => String(album.artist?.id) === String(artistId))
      .map(mapAlbum);
  } catch {
    // The artist endpoint result is still useful on its own.
    return [];
  }
}

function mergeAlbums(primary, extra) {
  const byId = new Map();
  for (const album of [...primary, ...extra]) {
    if (album?.id && !byId.has(album.id)) byId.set(album.id, album);
  }

  return [...byId.values()];
}

// Album search results carry no release_date, and the artist album endpoint is
// incomplete for some artists, so a merged discography needs the dates back to
// be ordered. Dates never change, so they are cached per warm instance.
const ALBUM_DATE_CONCURRENCY = 6;
const MAX_ALBUM_DATE_LOOKUPS = 48;
const MAX_ALBUM_DATE_CACHE = 2000;
const albumDateCache = new Map();

async function fetchAlbumReleaseDate(externalId) {
  const key = String(externalId);
  const cached = albumDateCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const data = await deezerFetch(`/album/${encodeURIComponent(key)}`);
    const date = data.release_date ?? '';
    if (date) {
      if (albumDateCache.size >= MAX_ALBUM_DATE_CACHE) albumDateCache.clear();
      albumDateCache.set(key, date);
    }
    return date;
  } catch {
    return '';
  }
}

async function fillReleaseDates(albums, maxLookups = MAX_ALBUM_DATE_LOOKUPS) {
  const missing = albums
    .filter((album) => !album.releaseDate)
    .slice(0, maxLookups);
  const queue = [...missing];

  await Promise.all(
    Array.from(
      { length: Math.min(ALBUM_DATE_CONCURRENCY, queue.length) },
      async () => {
        while (queue.length) {
          const album = queue.shift();
          const date = await fetchAlbumReleaseDate(album.externalId);
          if (date) album.releaseDate = date;
        }
      },
    ),
  );

  return albums;
}

function sortAlbums(albums, limit) {
  return [...albums]
    .sort((a, b) =>
      String(b.releaseDate ?? '').localeCompare(String(a.releaseDate ?? '')),
    )
    .slice(0, limit);
}

const deezerAdapter = {
  id: PROVIDER,
  label: 'Deezer',
  isConfigured: () => true,

  async searchTracks(query, limit = 10) {
    const data = await deezerFetch(
      `/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
    return (data.data ?? []).map(mapTrack);
  },

  async searchAlbums(query, limit = 10) {
    const data = await deezerFetch(
      `/search/album?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
    return (data.data ?? []).map(mapAlbum);
  },

  async searchArtists(query, limit = 10) {
    const data = await deezerFetch(
      `/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
    return (data.data ?? []).map(mapArtist);
  },

  async getAlbum(id) {
    const data = await deezerFetch(`/album/${encodeURIComponent(id)}`);
    return mapAlbum(data);
  },

  async getAlbumTracks(id) {
    const data = await deezerFetch(`/album/${encodeURIComponent(id)}/tracks`);
    return (data.data ?? []).map(mapAlbumTrack);
  },

  async getArtist(id) {
    const data = await deezerFetch(`/artist/${encodeURIComponent(id)}`);
    return mapArtist(data);
  },

  async getArtistTopTracks(id, limit = 50) {
    const data = await deezerFetch(
      `/artist/${encodeURIComponent(id)}/top?limit=${limit}`,
    );
    return (data.data ?? []).map(mapTrack);
  },

  async getArtistAlbums(id, limit = 50, options = {}) {
    const data = await deezerFetch(
      `/artist/${encodeURIComponent(id)}/albums?limit=${limit}`,
    );
    const albums = (data.data ?? []).map(mapAlbum);

    let merged = albums;
    if (options.name) {
      // Deezer's artist albums endpoint is incomplete for some artists (it
      // reports a handful of releases while the catalog has many more, e.g.
      // SFDK). The album search index does know them, so it fills the gap.
      const extra = await searchArtistAlbums(id, options.name);
      merged = mergeAlbums(albums, extra);
    }

    // Only the views that sort the discography ask for dates: release
    // monitoring does not need them and must stay cheap.
    if (options.dates) await fillReleaseDates(merged);

    return sortAlbums(merged, limit);
  },

  async getTrack(id) {
    const data = await deezerFetch(`/track/${encodeURIComponent(id)}`);
    return mapTrackPreview(data);
  },
};

module.exports = {
  deezerFetch,
  mapTrack,
  mapAlbum,
  mapArtist,
  mapAlbumTrack,
  mapTrackPreview,
  mergeAlbums,
  searchArtistAlbums,
  fillReleaseDates,
  sortAlbums,
  deezerAdapter,
};
