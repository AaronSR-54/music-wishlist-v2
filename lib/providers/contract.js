'use strict';

const DEFAULT_PROVIDER = 'deezer';

const PROVIDER_ID_RE = /^[a-z0-9-]+$/;

class ProviderError extends Error {
  constructor(code, message, status = 502, details = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    Object.assign(this, details);
  }
}

function toCatalogId(provider, externalId) {
  if (!provider || !PROVIDER_ID_RE.test(provider)) {
    throw new ProviderError(
      'invalid_provider',
      `Invalid provider: ${provider}`,
      400,
    );
  }
  if (externalId === undefined || externalId === null || String(externalId) === '') {
    throw new ProviderError('invalid_external_id', 'Missing external id', 400);
  }
  return `${provider}:${externalId}`;
}

function parseCatalogId(value, fallback = DEFAULT_PROVIDER) {
  const raw = value === undefined || value === null ? '' : String(value);
  if (!raw) return null;

  const separator = raw.indexOf(':');
  if (separator === -1) {
    return { provider: fallback, externalId: raw };
  }

  const prefix = raw.slice(0, separator);
  const externalId = raw.slice(separator + 1);
  if (!PROVIDER_ID_RE.test(prefix) || !externalId) {
    return null;
  }

  return { provider: prefix, externalId };
}

function normalizeRecordType(recordType) {
  switch (String(recordType ?? '').toLowerCase()) {
    case 'single':
      return 'single';
    case 'ep':
      return 'ep';
    default:
      return 'album';
  }
}

function padReleaseDate(date, precision) {
  if (!date) return undefined;
  const parts = String(date).split('-');
  if (precision === 'year') return `${parts[0]}-01-01`;
  if (precision === 'month') return `${parts[0]}-${parts[1] ?? '01'}-01`;
  return String(date);
}

function pickCover(images, maxWidth = 640) {
  if (!Array.isArray(images) || images.length === 0) return '';
  const sorted = [...images]
    .filter((image) => image && image.url)
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const withinLimit = sorted.filter((image) => (image.width ?? 0) <= maxWidth);
  const pool = withinLimit.length > 0 ? withinLimit : sorted;
  return pool[pool.length - 1]?.url ?? '';
}

function omitUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== undefined && entry !== null,
    ),
  );
}

function buildItem(item) {
  return omitUndefined({
    id: toCatalogId(item.provider, item.externalId),
    externalId: String(item.externalId),
    provider: item.provider,
    name: item.name ?? '',
    artists: item.artists ?? [],
    coverUrl: item.coverUrl ?? '',
    type: item.type ?? 'track',
    uri: item.uri ?? '',
    artistId: item.artistId,
    albumId: item.albumId,
    albumName: item.albumName,
    fanCount: item.fanCount,
    albumCount: item.albumCount,
    previewUrl: item.previewUrl,
    trackNumber: item.trackNumber,
    releaseDate: item.releaseDate,
    duration: item.duration,
    title: item.title,
  });
}

function buildAlbum(album) {
  return omitUndefined({
    id: toCatalogId(album.provider, album.externalId),
    externalId: String(album.externalId),
    provider: album.provider,
    name: album.name ?? '',
    artists: album.artists ?? [],
    artist: album.artist ?? album.artists?.[0] ?? '',
    artistId: album.artistId,
    coverUrl: album.coverUrl ?? '',
    type: album.type ?? 'album',
    uri: album.uri ?? '',
    releaseDate: album.releaseDate,
    trackCount: album.trackCount,
  });
}

function buildAlbumTrack(track) {
  return omitUndefined({
    id: toCatalogId(track.provider, track.externalId),
    externalId: String(track.externalId),
    provider: track.provider,
    title: track.title ?? '',
    name: track.title ?? '',
    duration: track.duration ?? 0,
    trackNumber: track.trackNumber,
    previewUrl: track.previewUrl,
    artistId: track.artistId,
    albumId: track.albumId,
  });
}

function buildArtist(artist) {
  return omitUndefined({
    id: toCatalogId(artist.provider, artist.externalId),
    externalId: String(artist.externalId),
    provider: artist.provider,
    name: artist.name ?? '',
    type: 'artist',
    coverUrl: artist.coverUrl ?? '',
    image: artist.coverUrl ?? '',
    uri: artist.uri ?? '',
    fanCount: artist.fanCount,
    albumCount: artist.albumCount,
  });
}

module.exports = {
  DEFAULT_PROVIDER,
  PROVIDER_ID_RE,
  ProviderError,
  toCatalogId,
  parseCatalogId,
  normalizeRecordType,
  padReleaseDate,
  pickCover,
  omitUndefined,
  buildItem,
  buildAlbum,
  buildAlbumTrack,
  buildArtist,
};
