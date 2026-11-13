'use strict';

const {
  DEFAULT_PROVIDER,
  ProviderError,
  parseCatalogId,
} = require('./contract.js');
const { deezerAdapter } = require('./deezer.js');
const { youtubeAdapter } = require('./youtube.js');

// Two providers, two jobs: Deezer is the whole searchable catalog (artists,
// tracks, albums, EPs) and YouTube is only the videos filter.
const adapters = new Map([
  [deezerAdapter.id, deezerAdapter],
  [youtubeAdapter.id, youtubeAdapter],
]);

function listProviderStatus() {
  return [...adapters.values()].map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
    available: Boolean(adapter.isConfigured()),
  }));
}

function getProvider(id = DEFAULT_PROVIDER, { requireConfigured = true } = {}) {
  const adapter = adapters.get(String(id));
  if (!adapter) {
    throw new ProviderError('provider_unknown', `Unknown provider: ${id}`, 400, {
      provider: String(id),
    });
  }
  if (requireConfigured && !adapter.isConfigured()) {
    throw new ProviderError(
      'provider_unavailable',
      `Provider not configured: ${id}`,
      503,
      { provider: adapter.id },
    );
  }
  return adapter;
}

function resolveTarget(req, value = req.query.id) {
  const requested = req.query.provider ? String(req.query.provider) : undefined;
  const parsed = parseCatalogId(value, requested || DEFAULT_PROVIDER);
  if (!parsed) {
    throw new ProviderError('invalid_id', 'Invalid or missing id', 400);
  }

  const provider = getProvider(requested || parsed.provider);
  return {
    provider,
    externalId: parsed.externalId,
    neutral: req.query.format === 'neutral' || provider.id !== DEFAULT_PROVIDER,
  };
}

function resolveProvider(req) {
  return getProvider(
    req.query.provider ? String(req.query.provider) : DEFAULT_PROVIDER,
  );
}

function isNeutralFormat(req) {
  return req.query.format === 'neutral';
}

function sendProviderError(res, error) {
  if (error instanceof ProviderError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      provider: error.provider,
      retryAfter: error.retryAfter,
    });
  }

  console.error('[providers] Unexpected error:', error);
  return res.status(500).json({ error: 'Internal server error' });
}

function setCommonHeaders(res, cacheControl) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (cacheControl) {
    res.setHeader('Cache-Control', cacheControl);
  }
}

module.exports = {
  listProviderStatus,
  getProvider,
  resolveTarget,
  resolveProvider,
  isNeutralFormat,
  sendProviderError,
  setCommonHeaders,
};
