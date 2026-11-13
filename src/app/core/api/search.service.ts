import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Track } from '../../shared/models/track.model';
import { ReleaseItem, AlbumTrack } from '../../shared/models/release-item.model';
import {
  CatalogProviderInfo,
  CatalogSearchFilter,
} from '../../shared/models/catalog-provider';
import { CatalogAlbumInfo, CatalogArtist } from '../catalog/catalog.models';
import {
  CatalogSearchState,
  MusicCatalogService,
} from '../catalog/music-catalog.service';

/**
 * Backwards-compatible facade over MusicCatalogService.
 *
 * Components keep their existing call sites while all provider dispatch,
 * normalization and caching live in the catalog layer.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private catalog = inject(MusicCatalogService);

  readonly providers = this.catalog.providers;
  readonly availableProviders = this.catalog.availableProviders;
  readonly videosAvailable = this.catalog.videosAvailable;
  readonly providersReady = this.catalog.providersReady;
  readonly capabilities = this.catalog.capabilities;

  loadProviders(force = false): Observable<CatalogProviderInfo[]> {
    return this.catalog.loadProviders(force);
  }

  search(
    query: string,
    filters?: ReadonlySet<CatalogSearchFilter>,
  ): Observable<Track[]> {
    return this.catalog.search(query, filters);
  }

  getArtistTracks(artistId: string, limit?: number): Observable<Track[]> {
    return this.catalog.getArtistTracks(artistId, limit);
  }

  getArtist(artistId: string): Observable<CatalogArtist | null> {
    return this.catalog.getArtist(artistId);
  }

  getArtistReleases(
    artistId: string,
    artistName: string,
  ): Observable<ReleaseItem[]> {
    return this.catalog.getArtistReleases(artistId, artistName);
  }

  getArtistAlbums(artistId: string, artistName: string): Observable<ReleaseItem[]> {
    return this.catalog.getArtistAlbums(artistId, artistName);
  }

  getArtistEPs(artistId: string, artistName: string): Observable<ReleaseItem[]> {
    return this.catalog.getArtistEPs(artistId, artistName);
  }

  getArtistSingles(
    artistId: string,
    artistName: string,
  ): Observable<ReleaseItem[]> {
    return this.catalog.getArtistSingles(artistId, artistName);
  }

  getTrackPreview(trackId: string): Observable<string | undefined> {
    return this.catalog.getTrackPreview(trackId);
  }

  getAlbumTracks(albumId: string): Observable<AlbumTrack[]> {
    return this.catalog.getAlbumTracks(albumId);
  }

  getAlbum(albumId: string): Observable<CatalogAlbumInfo | null> {
    return this.catalog.getAlbum(albumId);
  }

  saveSearchState(
    query: string,
    selectedTypes: Set<CatalogSearchFilter>,
    results: Track[],
  ): void {
    this.catalog.saveSearchState(query, selectedTypes, results);
  }

  getSavedSearchState(): CatalogSearchState | null {
    return this.catalog.getSavedSearchState();
  }

  clearSearchState(): void {
    this.catalog.clearSearchState();
  }
}
