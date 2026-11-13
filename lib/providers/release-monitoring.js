'use strict';

const { parseCatalogId } = require('./contract.js');

function artistIdentity(artistId) {
  const parsed = parseCatalogId(artistId);
  if (!parsed) {
    throw new Error(`Invalid artist id: ${artistId}`);
  }
  return parsed;
}

function artistCacheKey(artistId, clientId, uid) {
  const parsed = artistIdentity(artistId);
  const key =
    parsed.provider === 'deezer'
      ? parsed.externalId
      : `${parsed.provider}:${parsed.externalId}`;
  return `artist-releases-cache/${clientId}_${uid}_${key}`;
}

function toLegacyAlbum(album) {
  return {
    id: String(album.externalId),
    catalogId: album.id,
    provider: album.provider,
    title: album.name,
    record_type: album.type,
    cover_medium: album.coverUrl,
    cover_big: album.coverUrl,
    release_date: album.releaseDate ?? '',
  };
}

function isWithinWindow(releaseDateStr, days, now = new Date()) {
  if (!releaseDateStr) return false;
  const releaseDate = new Date(releaseDateStr);
  if (isNaN(releaseDate.getTime())) return false;

  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const releaseDay = new Date(releaseDate);
  releaseDay.setUTCHours(0, 0, 0, 0);
  const cutoff = today.getTime() - Math.max(0, days) * 24 * 60 * 60 * 1000;

  return (
    releaseDay.getTime() >= cutoff && releaseDay.getTime() <= today.getTime()
  );
}

function selectNewReleases(albums, notifiedIds, days, now = new Date()) {
  const notified = new Set((notifiedIds ?? []).map(String));
  return (albums ?? []).filter((album) => {
    const isNew = isWithinWindow(album.release_date, days, now);
    return isNew && !notified.has(String(album.id));
  });
}

function groupFavoritesByProvider(favorites) {
  return (favorites ?? []).reduce((groups, favorite) => {
    const parsed = parseCatalogId(favorite.artistId);
    const provider = parsed?.provider ?? 'deezer';
    groups[provider] = groups[provider] ?? [];
    groups[provider].push(favorite);
    return groups;
  }, {});
}

function normalizeArtistId(value) {
  const parsed = parseCatalogId(value);
  return parsed ? `${parsed.provider}:${parsed.externalId}` : String(value);
}

/**
 * Expands each favorite to every Deezer profile the user merged into it, so a
 * split artist is monitored (and notified) as one. Removal is not needed:
 * merges are per-user documents and unmerge just deletes them.
 */
function expandFavoriteArtists(favorites, merges) {
  const aliasToPrimary = new Map();
  const aliasesByPrimary = new Map();
  const names = new Map();

  for (const favorite of favorites ?? []) {
    if (favorite?.artistId) {
      names.set(normalizeArtistId(favorite.artistId), favorite.name);
    }
  }

  for (const merge of merges ?? []) {
    if (!merge?.primaryArtistId || !merge?.aliasArtistId) continue;
    const primary = normalizeArtistId(merge.primaryArtistId);
    const alias = normalizeArtistId(merge.aliasArtistId);
    aliasToPrimary.set(alias, primary);
    aliasesByPrimary.set(primary, [
      ...(aliasesByPrimary.get(primary) ?? []),
      alias,
    ]);
    if (merge.primaryName) names.set(primary, merge.primaryName);
    if (merge.aliasName) names.set(alias, merge.aliasName);
  }

  const resolve = (artistId) => {
    let current = artistId;
    const seen = new Set();
    while (aliasToPrimary.has(current) && !seen.has(current)) {
      seen.add(current);
      current = aliasToPrimary.get(current);
    }
    return current;
  };

  const seen = new Set();
  const expanded = [];
  for (const favorite of favorites ?? []) {
    if (!favorite?.artistId) continue;
    const root = resolve(normalizeArtistId(favorite.artistId));
    const group = [root, ...(aliasesByPrimary.get(root) ?? [])];

    for (const artistId of group) {
      if (seen.has(artistId)) continue;
      seen.add(artistId);
      expanded.push({
        ...favorite,
        artistId,
        name: names.get(artistId) || favorite.name,
      });
    }
  }

  return expanded;
}

module.exports = {
  artistIdentity,
  artistCacheKey,
  toLegacyAlbum,
  isWithinWindow,
  selectNewReleases,
  groupFavoritesByProvider,
  expandFavoriteArtists,
};
