import { TrackType } from './track.model';

export interface WishlistEntry {
  id?: string;
  trackId: string;
  name: string;
  artist: string;
  coverUrl: string;
  type: TrackType;
  addedAt: number;
  addedBy: string;
  addedByUid: string;
  downloaded: boolean;
  sharedWith?: string[];
  artistId?: string;
  albumId?: string;
  albumName?: string;
  /** Runtime-only ownership flag added when entries are merged for display. */
  isOwner?: boolean;
}
