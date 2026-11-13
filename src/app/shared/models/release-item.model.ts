import { CatalogProviderId } from './catalog-provider';
import { TrackType } from './track.model';

export interface AlbumTrack {
  id: string;
  externalId?: string;
  provider?: CatalogProviderId;
  title: string;
  duration: number;
  previewUrl?: string;
  trackNumber: number;
}

export interface ReleaseItem {
  id: string;
  externalId?: string;
  provider?: CatalogProviderId;
  name: string;
  artist: string;
  coverUrl: string;
  type: TrackType;
  releaseDate: string;
  previewUrl?: string;
  artistId?: string;
  uri?: string;
  tracks?: AlbumTrack[];
}
