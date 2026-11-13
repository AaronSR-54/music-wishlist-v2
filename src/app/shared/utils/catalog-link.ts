import { CatalogProviderId } from '../models/catalog-provider';
import { parseCatalogId } from '../../core/catalog/catalog-id';

export type CatalogLinkKind = 'track' | 'album' | 'artist';

interface CatalogLinkItem {
  id?: string;
  externalId?: string;
  provider?: CatalogProviderId;
  type?: string;
  uri?: string;
}

export function catalogLinkKind(type?: string): CatalogLinkKind {
  if (type === 'artist') return 'artist';
  if (type === 'track' || type === 'video') return 'track';
  return 'album';
}

export function catalogExternalUrl(
  item: CatalogLinkItem | null | undefined,
  kind?: CatalogLinkKind,
): string | null {
  if (!item?.id) return item?.uri ?? null;

  const parsed = parseCatalogId(item.id, item.provider);
  if (!parsed) return item.uri ?? null;

  const itemKind = kind ?? catalogLinkKind(item.type);
  if (parsed.provider === 'youtube') {
    if (itemKind === 'album') {
      return `https://www.youtube.com/playlist?list=${parsed.externalId}`;
    }
    if (itemKind === 'artist') {
      return `https://www.youtube.com/channel/${parsed.externalId}`;
    }
    return `https://www.youtube.com/watch?v=${parsed.externalId}`;
  }
  if (parsed.provider === 'deezer') {
    return `https://www.deezer.com/${itemKind}/${parsed.externalId}`;
  }
  return item.uri ?? null;
}

export function catalogExportLine(
  item: CatalogLinkItem | null | undefined,
  kind?: CatalogLinkKind,
): string | null {
  const url = catalogExternalUrl(item, kind);
  if (!url) return null;

  const parsed = parseCatalogId(item?.id, item?.provider);
  return parsed?.provider === 'deezer' ? `godeez ${url}` : url;
}
