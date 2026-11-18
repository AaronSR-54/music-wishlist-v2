'use strict';

const { DEFAULT_PROVIDER } = require('./contract.js');
const { deezerFetch } = require('./deezer.js');
const {
  isNeutralFormat,
  listProviderStatus,
  resolveProvider,
  resolveTarget,
  sendProviderError,
  setCommonHeaders,
} = require('./index.js');

function neutralEnvelope(res, provider, data, cacheControl) {
  setCommonHeaders(res, cacheControl);
  return res.json({ provider: provider.id, data });
}

function missing(res, message) {
  return res.status(400).json({ error: message });
}

function createSearchHandler() {
  return async (req, res) => {
    if (req.query?.providers) {
      setCommonHeaders(res);
      return res.json({ providers: listProviderStatus() });
    }

    const query = req.query?.q;
    if (!query) return missing(res, 'Missing query parameter');

    try {
      const provider = resolveProvider(req);
      if (isNeutralFormat(req) || provider.id !== DEFAULT_PROVIDER) {
        const data = await provider.searchTracks(String(query), 10);
        return neutralEnvelope(res, provider, data);
      }

      const data = await deezerFetch(
        `/search?q=${encodeURIComponent(query)}&limit=10`,
      );
      setCommonHeaders(res);
      return res.json(data);
    } catch (error) {
      return sendProviderError(res, error);
    }
  };
}

function createAlbumSearchHandler() {
  return async (req, res) => {
    const query = req.query?.q;
    if (!query) return missing(res, 'Missing query parameter');

    try {
      const provider = resolveProvider(req);
      if (isNeutralFormat(req) || provider.id !== DEFAULT_PROVIDER) {
        const data = await provider.searchAlbums(String(query), 10);
        return neutralEnvelope(res, provider, data);
      }

      const data = await deezerFetch(
        `/search/album?q=${encodeURIComponent(query)}&limit=10`,
      );
      setCommonHeaders(res);
      return res.json(data);
    } catch (error) {
      return sendProviderError(res, error);
    }
  };
}

function createArtistSearchHandler() {
  return async (req, res) => {
    const query = req.query?.q;
    if (!query) return missing(res, 'Missing query parameter');

    try {
      const provider = resolveProvider(req);
      if (isNeutralFormat(req) || provider.id !== DEFAULT_PROVIDER) {
        const data = await provider.searchArtists(String(query), 25);
        return neutralEnvelope(res, provider, data);
      }

      const data = await deezerFetch(
        `/search/artist?q=${encodeURIComponent(query)}&limit=25`,
      );
      setCommonHeaders(res);
      return res.json(data);
    } catch (error) {
      return sendProviderError(res, error);
    }
  };
}

function createAlbumHandler() {
  return async (req, res) => {
    if (!req.query?.id) return missing(res, 'Missing album ID');

    try {
      const { provider, externalId, neutral } = resolveTarget(req);
      if (neutral) {
        const data = await provider.getAlbum(externalId);
        return neutralEnvelope(res, provider, data);
      }

      const data = await deezerFetch(`/album/${encodeURIComponent(externalId)}`);
      setCommonHeaders(res);
      return res.json(data);
    } catch (error) {
      return sendProviderError(res, error);
    }
  };
}

function createAlbumTracksHandler() {
  return async (req, res) => {
    if (!req.query?.id) return missing(res, 'Missing album ID');

    try {
      const { provider, externalId, neutral } = resolveTarget(req);
      const data = neutral
        ? await provider.getAlbumTracks(externalId)
        : await deezerFetch(
            `/album/${encodeURIComponent(externalId)}/tracks`,
          );

      if (neutral) return neutralEnvelope(res, provider, data);

      setCommonHeaders(res);
      return res.json(data);
    } catch (error) {
      return sendProviderError(res, error);
    }
  };
}

function createArtistTopTracksHandler() {
  return async (req, res) => {
    if (!req.query?.id) return missing(res, 'Missing artist ID');

    try {
      const { provider, externalId, neutral } = resolveTarget(req);
      if (neutral) {
        const data = await provider.getArtistTopTracks(externalId, 50);
        return neutralEnvelope(res, provider, data);
      }

      const data = await deezerFetch(
        `/artist/${encodeURIComponent(externalId)}/top?limit=50`,
      );
      setCommonHeaders(res);
      return res.json(data);
    } catch (error) {
      return sendProviderError(res, error);
    }
  };
}

function createArtistInfoHandler() {
  return async (req, res) => {
    if (!req.query?.id) return missing(res, 'Missing artist ID');

    try {
      const { provider, externalId, neutral } = resolveTarget(req);
      if (neutral) {
        const data = await provider.getArtist(externalId);
        return neutralEnvelope(res, provider, data);
      }

      const data = await deezerFetch(`/artist/${encodeURIComponent(externalId)}`);
      setCommonHeaders(res);
      return res.json(data);
    } catch (error) {
      return sendProviderError(res, error);
    }
  };
}

function createArtistAlbumsHandler() {
  return async (req, res) => {
    if (!req.query?.id) return missing(res, 'Missing id parameter');

    const requested = Number(req.query.limit);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1), 100)
      : 100;

    try {
      const { provider, externalId, neutral } = resolveTarget(req);
      if (neutral) {
        const data = await provider.getArtistAlbums(externalId, limit, {
          name: typeof req.query.name === 'string' ? req.query.name : undefined,
          dates: Boolean(req.query.dates),
        });
        // Completing a discography costs extra upstream calls, so browsers and
        // the CDN may reuse the answer for a while.
        return neutralEnvelope(
          res,
          provider,
          data,
          'public, max-age=3600, s-maxage=3600',
        );
      }

      const data = await deezerFetch(
        `/artist/${encodeURIComponent(externalId)}/albums?limit=${limit}`,
      );
      setCommonHeaders(res, 'public, max-age=21600');
      return res.json(data);
    } catch (error) {
      return sendProviderError(res, error);
    }
  };
}

function createTrackHandler() {
  return async (req, res) => {
    if (!req.query?.id) return missing(res, 'Missing track ID');

    try {
      const { provider, externalId, neutral } = resolveTarget(req);
      if (neutral) {
        const data = await provider.getTrack(externalId);
        return neutralEnvelope(res, provider, data);
      }

      const data = await deezerFetch(`/track/${encodeURIComponent(externalId)}`);
      setCommonHeaders(res);
      return res.json(data);
    } catch (error) {
      return sendProviderError(res, error);
    }
  };
}

module.exports = {
  createSearchHandler,
  createAlbumSearchHandler,
  createArtistSearchHandler,
  createAlbumHandler,
  createAlbumTracksHandler,
  createArtistTopTracksHandler,
  createArtistInfoHandler,
  createArtistAlbumsHandler,
  createTrackHandler,
};
