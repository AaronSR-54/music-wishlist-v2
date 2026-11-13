import { CatalogProviderId } from '../../shared/models/catalog-provider';

export interface CatalogArtist {
  id: string;
  externalId?: string;
  provider?: CatalogProviderId;
  name: string;
  coverUrl: string;
  uri?: string;
  fanCount?: number;
  albumCount?: number;
}

export interface CatalogAlbumInfo {
  id: string;
  externalId?: string;
  provider?: CatalogProviderId;
  name: string;
  artist: string;
  artistId?: string;
  coverUrl: string;
  type: string;
  releaseDate: string;
  uri?: string;
}

export interface CatalogEnvelope<T> {
  provider: CatalogProviderId;
  data: T;
}

export interface CatalogProviderStatusResponse {
  providers: Array<{
    id: CatalogProviderId;
    label: string;
    available: boolean;
  }>;
}

export class CatalogError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly provider: CatalogProviderId | undefined,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}
