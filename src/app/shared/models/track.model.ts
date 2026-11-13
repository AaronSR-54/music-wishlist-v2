import { CatalogProviderId } from './catalog-provider';

export type TrackType = 'track' | 'album' | 'ep' | 'single' | 'artist' | 'video';

export interface Track {
  id: string;
  externalId?: string;
  provider?: CatalogProviderId;
  name: string;
  artists: string[];
  coverUrl: string;
  type: TrackType;
  uri: string;
  artistId?: string;
  albumId?: string;
  albumName?: string;
  fanCount?: number;
  albumCount?: number;
  previewUrl?: string;
  trackNumber?: number;
}
