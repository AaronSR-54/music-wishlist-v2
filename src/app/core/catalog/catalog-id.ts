import {
  CatalogProviderId,
  DEFAULT_CATALOG_PROVIDER,
} from '../../shared/models/catalog-provider';

const PROVIDER_ID_RE = /^[a-z0-9-]+$/;

export interface CatalogIdParts {
  provider: CatalogProviderId;
  externalId: string;
}

export function toCatalogId(
  provider: CatalogProviderId,
  externalId: string | number,
): string {
  const value = String(externalId ?? '');
  if (!PROVIDER_ID_RE.test(String(provider))) {
    throw new Error(`Invalid provider: ${provider}`);
  }
  if (!value) {
    throw new Error('Missing external id');
  }
  return `${provider}:${value}`;
}

export function parseCatalogId(
  value: string | number | null | undefined,
  fallback: CatalogProviderId = DEFAULT_CATALOG_PROVIDER,
): CatalogIdParts | null {
  if (value === null || value === undefined) return null;
  const raw = String(value);
  if (!raw) return null;

  const separator = raw.indexOf(':');
  if (separator === -1) {
    return { provider: fallback, externalId: raw };
  }

  const provider = raw.slice(0, separator);
  const externalId = raw.slice(separator + 1);
  if (!PROVIDER_ID_RE.test(provider) || !externalId) return null;

  return { provider: provider as CatalogProviderId, externalId };
}

export function catalogProviderOf(
  value: string | number | null | undefined,
  fallback: CatalogProviderId = DEFAULT_CATALOG_PROVIDER,
): CatalogProviderId {
  return parseCatalogId(value, fallback)?.provider ?? fallback;
}

export function isCatalogProviderId(value: unknown): value is CatalogProviderId {
  return typeof value === 'string' && PROVIDER_ID_RE.test(value);
}
