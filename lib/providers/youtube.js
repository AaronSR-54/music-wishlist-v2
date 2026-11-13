'use strict';

const { ProviderError, buildAlbum, buildAlbumTrack, buildArtist, buildItem, toCatalogId } = require('./contract.js');

const BASE = 'https://www.googleapis.com/youtube/v3';
const PROVIDER = 'youtube';
const MUSIC_CATEGORY_ID = '10';
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 60;

/**
 * In-memory cache for the 100-unit calls (search). Warm Lambda instances reuse
 * it, which keeps artist/album pages well inside the daily quota.
 */
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_LIMIT) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

async function cached(key, loader) {
  const hit = cacheGet(key);
  if (hit !== null) return hit;
  return cacheSet(key, await loader());
}

function clearYoutubeCache() {
  cache.clear();
}

function isYoutubeConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

function regionCode() {
  return process.env.YOUTUBE_REGION || 'US';
}

function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** "Daft Punk - Topic" is the auto-generated channel; users know the artist. */
function artistName(channelTitle) {
  return decodeEntities(channelTitle)
    .replace(/\s*-\s*topic$/i, '')
    .trim();
}

const TITLE_NOISE_RE =
  /\s*[\(\[]\s*(?:official\s*(?:music\s*)?(?:video|audio|visuali[sz]er|lyric\s*video)|lyric\s*video|visuali[sz]er|audio|hd|hq|4k)\s*[\)\]]\s*$/i;

function cleanTitle(title, channelTitle) {
  let value = decodeEntities(title).trim();
  const artist = normalizeName(artistName(channelTitle).replace(/vevo$/i, ''));
  const prefix = /^(.+?)\s*[-–—]\s+/.exec(value);

  if (artist && prefix && normalizeName(prefix[1]) === artist) {
    value = value.slice(prefix[0].length);
  }

  let previous;
  do {
    previous = value;
    value = value.replace(TITLE_NOISE_RE, '').trim();
  } while (value !== previous);

  return value;
}

function isoDurationToSeconds(value) {
  const match =
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? '');
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match;
  return (
    Number(days || 0) * 86400 +
    Number(hours || 0) * 3600 +
    Number(minutes || 0) * 60 +
    Number(seconds || 0)
  );
}

/** YouTube has no release type; infer it from the item count. */
function releaseType(trackCount, title) {
  if (/\bep\b/i.test(String(title ?? ''))) return 'ep';
  if (trackCount <= 1) return 'single';
  if (trackCount <= 6) return 'ep';
  return 'album';
}

function watchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function playlistUrl(playlistId) {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

function channelUrl(channelId) {
  return `https://www.youtube.com/channel/${channelId}`;
}

function thumbnails(snippet) {
  return (
    snippet?.thumbnails?.maxres?.url ??
    snippet?.thumbnails?.standard?.url ??
    snippet?.thumbnails?.high?.url ??
    snippet?.thumbnails?.medium?.url ??
    snippet?.thumbnails?.default?.url ??
    ''
  );
}

function videoIdOf(item) {
  // Playlist items carry their own id; the video id lives in contentDetails.
  return (
    item?.contentDetails?.videoId ??
    item?.id?.videoId ??
    (typeof item?.id === 'string' ? item.id : null)
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max);
}

async function youtubeFetch(path) {
  if (!isYoutubeConfigured()) {
    throw new ProviderError(
      'provider_unavailable',
      'YouTube is not configured',
      503,
      { provider: PROVIDER },
    );
  }

  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(
    `${BASE}${path}${separator}key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`,
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const quotaExceeded =
      response.status === 403 && /quotaExceeded|dailyLimitExceeded/i.test(body);
    throw new ProviderError(
      'upstream_error',
      `YouTube request failed: ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
      response.status === 429 || quotaExceeded ? 503 : 502,
      { provider: PROVIDER },
    );
  }

  return response.json();
}

async function videosByIds(ids, part = 'contentDetails') {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (unique.length === 0) return new Map();

  const data = await youtubeFetch(
    `/videos?part=${part}&id=${unique.join(',')}&maxResults=50`,
  );
  return new Map((data.items ?? []).map((item) => [item.id, item]));
}

async function channelDetails(ids, part = 'snippet,statistics') {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (unique.length === 0) return new Map();

  const data = await youtubeFetch(`/channels?part=${part}&id=${unique.join(',')}`);
  return new Map((data.items ?? []).map((item) => [item.id, item]));
}

async function playlistDetails(ids) {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (unique.length === 0) return new Map();

  const data = await youtubeFetch(
    `/playlists?part=snippet,contentDetails&id=${unique.join(',')}`,
  );
  return new Map((data.items ?? []).map((item) => [item.id, item]));
}

function notFound(entity) {
  return new ProviderError('not_found', `${entity} not found`, 404, {
    provider: PROVIDER,
  });
}

/** Official music sources: artist/label channels ending in VEVO or owned by YT Music. */
function isOfficialChannel(channelTitle) {
  const value = String(channelTitle ?? '').trim();
  return /-\s*topic$/i.test(value) || /vevo$/i.test(value);
}

function normalizeName(value) {
  return decodeEntities(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function channelMatchesQuery(channelTitle, query) {
  const channel = normalizeName(artistName(channelTitle).replace(/vevo$/i, ''));
  const term = normalizeName(query);
  if (!channel || !term) return false;
  return term.includes(channel) || channel.includes(term);
}

/**
 * Playlists that are not a release: compilations, video collections, mixes.
 * "Full album" is allowed only on an official channel.
 */
const NON_RELEASE_RE =
  /\b(official videos|audio videos|essentials|best of|greatest hits|mix|megamix|remixes|live|experience|compilation|mixtape|reaction)\b/i;

function isReleasePlaylist(snippet, query) {
  if (!snippet?.title) return false;
  const title = decodeEntities(snippet.title);
  if (NON_RELEASE_RE.test(title)) return false;

  const official = isOfficialChannel(snippet.channelTitle);
  if (!official && /\bfull album\b/i.test(title)) return false;
  if (!official && !channelMatchesQuery(snippet.channelTitle, query)) return false;
  return true;
}

const MUSIC_TOPIC_RE =
  /(music|electronic_music|pop_music|rock_music|hip_hop_music|soul_music|jazz|classical)/i;

function isMusicChannel(channel) {
  if (/- topic$/i.test(String(channel?.snippet?.title ?? ''))) return true;
  return (channel?.topicDetails?.topicCategories ?? []).some((url) =>
    MUSIC_TOPIC_RE.test(url),
  );
}

function mapSearchItem(item, video) {
  const videoId = videoIdOf(item);
  if (!videoId) return null;

  const snippet = video?.snippet ?? item.snippet;
  const channelTitle = snippet?.channelTitle;
  const channelId = snippet?.channelId ?? item.snippet?.channelId;

  return buildItem({
    provider: PROVIDER,
    externalId: videoId,
    name: cleanTitle(snippet?.title, channelTitle),
    artists: channelTitle ? [artistName(channelTitle)] : [],
    coverUrl: thumbnails(snippet),
    type: 'track',
    uri: watchUrl(videoId),
    artistId: channelId ? toCatalogId(PROVIDER, channelId) : undefined,
    duration: video ? isoDurationToSeconds(video.contentDetails?.duration) : undefined,
    releaseDate: snippet?.publishedAt
      ? String(snippet.publishedAt).slice(0, 10)
      : undefined,
  });
}

function cleanAlbumTitle(title, channelTitle) {
  let value = cleanTitle(title, channelTitle);
  const artistKey = normalizeName(artistName(channelTitle).replace(/vevo$/i, ''));

  let previous;
  do {
    previous = value;
    value = value
      .replace(/\s*\((?:official\s*)?album\s*playlist\)\s*$/i, '')
      .replace(/\s+album\s*$/i, '')
      .trim();
  } while (value !== previous);

  const quoted = /^(.+?)\s+'(.+)'$/.exec(value);
  if (artistKey && quoted && normalizeName(quoted[1]) === artistKey) {
    value = quoted[2];
  }

  return value;
}

function mapPlaylist(item) {
  const count = Number(item.contentDetails?.itemCount ?? 0);
  const name = cleanAlbumTitle(item.snippet?.title, item.snippet?.channelTitle);
  const artist = artistName(item.snippet?.channelTitle);
  const channelId = item.snippet?.channelId;

  return buildAlbum({
    provider: PROVIDER,
    externalId: item.id,
    name,
    artists: artist ? [artist] : [],
    artist,
    artistId: channelId ? toCatalogId(PROVIDER, channelId) : undefined,
    coverUrl: thumbnails(item.snippet),
    type: releaseType(count, name),
    uri: playlistUrl(item.id),
    releaseDate: item.snippet?.publishedAt
      ? String(item.snippet.publishedAt).slice(0, 10)
      : undefined,
    trackCount: count || undefined,
  });
}

function mapPlaylistTrack(item, video, index) {
  const videoId = videoIdOf(item);
  if (!videoId) return null;

  const snippet = video?.snippet ?? item.snippet;
  const channelTitle =
    item.snippet?.videoOwnerChannelTitle ?? snippet?.channelTitle;
  const channelId =
    item.snippet?.videoOwnerChannelId ?? snippet?.channelId;
  const position = Number(item.snippet?.position);

  return buildAlbumTrack({
    provider: PROVIDER,
    externalId: videoId,
    title: cleanTitle(snippet?.title ?? item.snippet?.title, channelTitle),
    duration: video ? isoDurationToSeconds(video.contentDetails?.duration) : 0,
    trackNumber: Number.isFinite(position) ? position + 1 : index + 1,
    artistId: channelId ? toCatalogId(PROVIDER, channelId) : undefined,
  });
}

function mapChannel(channel) {
  const subscribers = channel.statistics?.hiddenSubscriberCount
    ? undefined
    : Number(channel.statistics?.subscriberCount);

  return buildArtist({
    provider: PROVIDER,
    externalId: channel.id,
    name: artistName(channel.snippet?.title),
    coverUrl:
      thumbnails(channel.snippet) ||
      channel.brandingSettings?.image?.bannerExternalUrl ||
      '',
    uri: channelUrl(channel.id),
    fanCount: Number.isFinite(subscribers) && subscribers > 0 ? subscribers : undefined,
  });
}

const youtubeAdapter = {
  id: PROVIDER,
  label: 'YouTube',
  isConfigured: isYoutubeConfigured,

  async searchTracks(query, limit = 10) {
    const capped = clamp(limit, 1, 50);
    const data = await youtubeFetch(
      `/search?part=snippet&type=video&videoCategoryId=${MUSIC_CATEGORY_ID}&maxResults=${capped}&regionCode=${encodeURIComponent(regionCode())}&q=${encodeURIComponent(query)}`,
    );

    const items = data.items ?? [];
    const videos = await videosByIds(items.map(videoIdOf), 'contentDetails');

    return items
      .map((item) => mapSearchItem(item, videos.get(videoIdOf(item))))
      .filter(Boolean);
  },

  async searchAlbums(query, limit = 10) {
    const capped = clamp(limit, 1, 50);

    return cached(`yt:albums:${query}:${capped}`, async () => {
      const data = await youtubeFetch(
        `/search?part=snippet&type=playlist&maxResults=${Math.min(capped * 2, 50)}&q=${encodeURIComponent(query)}`,
      );

      const candidates = (data.items ?? []).filter(
        (item) =>
          Boolean(item.id?.playlistId) &&
          isReleasePlaylist(item.snippet, query),
      );

      const candidateIds = new Set(candidates.map((item) => item.id.playlistId));
      const details = await playlistDetails([...candidateIds]);

      const seen = new Set();
      return [...details.values()]
        .filter(
          (item) =>
            candidateIds.has(item.id) &&
            isReleasePlaylist(item.snippet, query),
        )
        .map(mapPlaylist)
        .filter((album) => {
          const key = `${album.name}|${album.artist}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, capped);
    });
  },

  async searchArtists(query, limit = 10) {
    const capped = clamp(limit, 1, 50);

    return cached(`yt:artists:${query}:${capped}`, async () => {
      const data = await youtubeFetch(
        `/search?part=snippet&type=channel&maxResults=${Math.min(capped * 2, 50)}&q=${encodeURIComponent(query)}`,
      );

      const ids = (data.items ?? [])
        .map((item) => item.id?.channelId)
        .filter(Boolean);
      const channels = await channelDetails(
        ids,
        'snippet,statistics,topicDetails',
      );

      return ids
        .map((id) => channels.get(id))
        .filter((channel) => channel && isMusicChannel(channel))
        .sort(
          (a, b) =>
            Number(b.statistics?.subscriberCount ?? 0) -
            Number(a.statistics?.subscriberCount ?? 0),
        )
        .slice(0, capped)
        .map(mapChannel);
    });
  },

  async getAlbum(id) {
    return cached(`yt:album:${id}`, async () => {
      const details = await playlistDetails([id]);
      const item = details.get(String(id));
      if (!item) throw notFound('Album');
      return mapPlaylist(item);
    });
  },

  async getAlbumTracks(id) {
    const data = await youtubeFetch(
      `/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${encodeURIComponent(id)}`,
    );

    const items = data.items ?? [];
    const videos = await videosByIds(
      items.map(videoIdOf),
      'snippet,contentDetails',
    );

    return items
      .map((item, index) =>
        mapPlaylistTrack(item, videos.get(videoIdOf(item)), index),
      )
      .filter(Boolean);
  },

  async getArtist(id) {
    return cached(`yt:artist:${id}`, async () => {
      const data = await youtubeFetch(
        `/channels?part=snippet,statistics,brandingSettings&id=${encodeURIComponent(id)}`,
      );
      const channel = (data.items ?? [])[0];
      if (!channel) throw notFound('Artist');
      return mapChannel(channel);
    });
  },

  async getArtistTopTracks(id, limit = 10) {
    const capped = clamp(limit, 1, 50);

    const channel = await youtubeFetch(
      `/channels?part=contentDetails&id=${encodeURIComponent(id)}`,
    );
    const uploads =
      channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return [];

    const data = await youtubeFetch(
      `/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${encodeURIComponent(uploads)}`,
    );

    const items = data.items ?? [];
    const videos = await videosByIds(
      items.map(videoIdOf),
      'snippet,statistics,contentDetails',
    );

    return items
      .map((item) => {
        const video = videos.get(videoIdOf(item));
        const track = mapSearchItem(item, video);
        if (!track) return null;

        // Official channels mix trailers, interviews and Shorts into uploads.
        if (video?.snippet?.categoryId && video.snippet.categoryId !== MUSIC_CATEGORY_ID) {
          return null;
        }
        if (video && (track.duration ?? 0) < 60) return null;

        return {
          track: { ...track, artistId: toCatalogId(PROVIDER, id) },
          views: Number(video?.statistics?.viewCount ?? 0),
        };
      })
      .filter((entry) => entry?.track)
      .sort((a, b) => b.views - a.views)
      .slice(0, capped)
      .map((entry) => entry.track);
  },

  async getArtistAlbums(id, limit = 50) {
    const capped = clamp(limit, 1, 50);

    return cached(`yt:artist-albums:${id}:${capped}`, async () => {
      // One 100-unit search per channel; reused by every limit.
      const playlistIds = await cached(`yt:channel-playlists:${id}`, async () => {
        const data = await youtubeFetch(
          `/search?part=snippet&type=playlist&channelId=${encodeURIComponent(id)}&maxResults=50`,
        );
        return (data.items ?? [])
          .map((item) => item.id?.playlistId)
          .filter(Boolean);
      });

      if (playlistIds.length === 0) return [];

      const details = await playlistDetails(playlistIds);

      return [...details.values()]
        .filter(
          (item) =>
            !NON_RELEASE_RE.test(decodeEntities(item.snippet?.title)),
        )
        .map(mapPlaylist)
        .sort((a, b) =>
          (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''),
        )
        .slice(0, capped);
    });
  },

  async getTrack(id) {
    const data = await youtubeFetch(
      `/videos?part=snippet,contentDetails&id=${encodeURIComponent(id)}`,
    );
    const item = (data.items ?? [])[0];
    if (!item) throw notFound('Track');

    return {
      id: toCatalogId(PROVIDER, item.id),
      externalId: String(item.id),
      provider: PROVIDER,
      name: cleanTitle(item.snippet?.title, item.snippet?.channelTitle),
      artists: item.snippet?.channelTitle
        ? [artistName(item.snippet.channelTitle)]
        : [],
      coverUrl: thumbnails(item.snippet),
      uri: watchUrl(item.id),
      duration: isoDurationToSeconds(item.contentDetails?.duration),
    };
  },
};

module.exports = {
  youtubeFetch,
  mapSearchItem,
  mapPlaylist,
  mapChannel,
  isYoutubeConfigured,
  clearYoutubeCache,
  youtubeAdapter,
};
