import {
  CatalogProviderId,
  DEFAULT_CATALOG_PROVIDER,
} from '../../shared/models/catalog-provider';
import { parseCatalogId, toCatalogId } from './catalog-id';

export interface ProviderIdentifiable {
  id?: string;
  externalId?: string;
  provider?: CatalogProviderId;
}

export function normalizeProvider(
  provider: CatalogProviderId | undefined,
  fallback: CatalogProviderId = DEFAULT_CATALOG_PROVIDER,
): CatalogProviderId {
  return provider ?? fallback;
}

export function normalizeCatalogItem<T extends ProviderIdentifiable>(
  item: T,
  fallback: CatalogProviderId = DEFAULT_CATALOG_PROVIDER,
): T & { provider: CatalogProviderId; externalId: string; id: string } {
  const parsed = parseCatalogId(item.id, item.provider ?? fallback);
  const provider = item.provider ?? parsed?.provider ?? fallback;
  const externalId = item.externalId ?? parsed?.externalId ?? '';

  if (!externalId) {
    return {
      ...item,
      provider,
      externalId,
      id: item.id ?? '',
    };
  }

  return {
    ...item,
    provider,
    externalId,
    id: toCatalogId(provider, externalId),
  };
}
