export type CatalogProviderId = 'deezer' | 'youtube';

export interface CatalogProviderInfo {
  id: CatalogProviderId;
  label: string;
  available: boolean;
}

/** Result kinds a provider can return from a search. */
export type CatalogSearchType = 'artist' | 'track' | 'album' | 'ep';

/**
 * Result kinds the search filters can request. The first four are the Deezer
 * catalog; `video` is the YouTube source and costs its own single call.
 */
export type CatalogSearchFilter = CatalogSearchType | 'video';

export interface CatalogProviderCapabilities {
  /**
   * Result kinds returned by a search. Filters are built from this list, so a
   * provider never offers a filter that cannot produce results.
   */
  searchTypes: readonly CatalogSearchType[];
  /** Whether tracks expose 30-second audio previews. */
  previews: boolean;
  /** Whether album/EP detail pages are available. */
  albumDetail: boolean;
  /** Whether artist detail pages are available. */
  artistDetail: boolean;
}

const FULL_CATALOG: CatalogProviderCapabilities = {
  searchTypes: ['artist', 'track', 'album', 'ep'],
  previews: true,
  albumDetail: true,
  artistDetail: true,
};

/** Capabilities of the searchable catalog the filters are built from. */
export const CATALOG_CAPABILITIES: CatalogProviderCapabilities = FULL_CATALOG;

export const DEFAULT_CATALOG_PROVIDER: CatalogProviderId = 'deezer';

/**
 * Searchable catalog providers, in priority order. Deezer is the whole
 * catalog: artists, tracks, albums and EPs with proxied previews.
 * YouTube is not part of it; it only backs the videos filter.
 */
export const CATALOG_MERGE_ORDER: readonly CatalogProviderId[] = ['deezer'];

export const CATALOG_PROVIDER_LABELS: Record<CatalogProviderId, string> = {
  deezer: 'Deezer',
  youtube: 'YouTube',
};

export const CATALOG_PROVIDER_CAPABILITIES: Record<
  CatalogProviderId,
  CatalogProviderCapabilities
> = {
  deezer: FULL_CATALOG,
  // YouTube only backs the videos filter. A search costs 100 quota units, so
  // its videos filter makes exactly one call; it is never part of the catalog
  // search and never adds artist/album/EP results.
  youtube: {
    searchTypes: [],
    previews: false,
    albumDetail: true,
    artistDetail: true,
  },
};
