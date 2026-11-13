import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ProviderError, parseCatalogId, toCatalogId } from '../../lib/providers/contract.js';
import {
  getProvider,
  listProviderStatus,
  resolveTarget,
} from '../../lib/providers/index.js';

test('toCatalogId and parseCatalogId round-trip', () => {
  assert.equal(toCatalogId('deezer', 123), 'deezer:123');
  assert.deepEqual(parseCatalogId('youtube:abc'), {
    provider: 'youtube',
    externalId: 'abc',
  });
});

test('legacy bare ids resolve to Deezer', () => {
  assert.deepEqual(parseCatalogId('6516139'), {
    provider: 'deezer',
    externalId: '6516139',
  });
});

test('invalid ids are rejected', () => {
  assert.equal(parseCatalogId(''), null);
  assert.equal(parseCatalogId(null), null);
  assert.equal(parseCatalogId('Bad Provider:1'), null);
  assert.equal(parseCatalogId('youtube:'), null);
  assert.throws(() => toCatalogId('youtube', ''), ProviderError);
});

test('registry reports provider availability from configuration', () => {
  const previous = { youtube: process.env.YOUTUBE_API_KEY };
  delete process.env.YOUTUBE_API_KEY;

  const without = listProviderStatus();
  assert.equal(without.length, 2);
  assert.equal(without.find((provider) => provider.id === 'deezer').available, true);
  assert.equal(without.find((provider) => provider.id === 'youtube').available, false);
  assert.equal(without.find((provider) => provider.id === 'spotify'), undefined);
  assert.equal(without.find((provider) => provider.id === 'itunes'), undefined);

  process.env.YOUTUBE_API_KEY = 'key';
  const configured = listProviderStatus();
  assert.equal(configured.find((provider) => provider.id === 'youtube').available, true);

  if (previous.youtube === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = previous.youtube;
});

test('unknown providers return a 400 ProviderError', () => {
  assert.throws(
    () => getProvider('tidal'),
    (error) => error instanceof ProviderError && error.status === 400,
  );
});

test('unconfigured providers return a 503 ProviderError', () => {
  const previous = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;

  assert.throws(
    () => getProvider('youtube'),
    (error) => error instanceof ProviderError && error.status === 503,
  );

  if (previous !== undefined) process.env.YOUTUBE_API_KEY = previous;
});

test('removed providers are no longer registered', () => {
  for (const id of ['spotify', 'itunes']) {
    assert.throws(
      () => getProvider(id),
      (error) => error instanceof ProviderError && error.status === 400,
    );
  }
});

test('resolveTarget honours a namespaced id and the provider override', () => {
  const namespaced = resolveTarget({ query: { id: 'deezer:42' } });
  assert.equal(namespaced.provider.id, 'deezer');
  assert.equal(namespaced.externalId, '42');
  assert.equal(namespaced.neutral, false);

  const overridden = resolveTarget({ query: { id: '42', provider: 'deezer', format: 'neutral' } });
  assert.equal(overridden.provider.id, 'deezer');
  assert.equal(overridden.externalId, '42');
  assert.equal(overridden.neutral, true);
});
