import { CatalogProviderId } from './catalog-provider';

export interface FavoriteArtist {
  id?: string;
  artistId: string;
  externalId?: string;
  provider?: CatalogProviderId;
  name: string;
  coverUrl: string;
  addedAt: number;
  addedByUid: string;
}
