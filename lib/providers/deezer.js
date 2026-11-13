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

  async getArtistAlbums(id, limit = 50) {
    const data = await deezerFetch(
      `/artist/${encodeURIComponent(id)}/albums?limit=${limit}`,
    );
    return (data.data ?? []).map(mapAlbum);
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
  deezerAdapter,
};
