import { Injectable, signal } from '@angular/core';
import { Observable, forkJoin, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Track, TrackType } from '../../shared/models/track.model';
import { ReleaseItem, AlbumTrack } from '../../shared/models/release-item.model';
import { AlbumInfo } from '../services/preview.service';
import {
  DeezerTrack,
  DeezerAlbum,
  DeezerArtist,
  DeezerTrackResponse,
  DeezerAlbumResponse,
  DeezerArtistResponse,
  DArtistResponse,
  DArtistTracksResponse,
  DReleasesResponse,
  DAlbumTracksResponse,
  DTrackPreviewResponse,
  DAlbumInfoResponse,
} from '../../shared/models/deezer';

interface SearchState {
  query: string;
  selectedTypes: Set<TrackType | 'artist'>;
  results: Track[];
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private apiUrl = '/api';
  private savedState = signal<SearchState | null>(null);

  private albumCache = new Map<string, any>();
  private albumTracksCache = new Map<string, AlbumTrack[]>();
  private artistCache = new Map<string, any>();
  private artistTracksCache = new Map<string, Track[]>();

  search(q: string): Observable<Track[]> {
    const term = encodeURIComponent(q);
    const searchTerm = q.toLowerCase();

    const songs$ = from(
      fetch(`${this.apiUrl}/search?q=${term}`).then((r) => r.json()),
    );

    const albums$ = from(
      fetch(`${this.apiUrl}/search/album?q=${term}`).then((r) => r.json()),
    );

    const artists$ = from(
      fetch(`${this.apiUrl}/search/artist?q=${term}`).then((r) => r.json()),
    );

    return forkJoin([songs$, albums$, artists$]).pipe(
      map(([songsRes, albumsRes, artistsRes]) => {
        const songsResponse = songsRes as DeezerTrackResponse;
        const albumsResponse = albumsRes as DeezerAlbumResponse;
        const artistsResponse = artistsRes as DeezerArtistResponse;

        const tracks: Track[] = (songsResponse.data ?? []).map((t: DeezerTrack) => ({
          id: String(t.id),
          name: t.title,
          artists: [t.artist?.name ?? ''],
          coverUrl: t.album?.cover_big ?? t.album?.cover_medium ?? '',
          type: 'track' as TrackType,
          uri: t.link ?? '',
          artistId: t.artist?.id ? String(t.artist.id) : undefined,
          albumId: t.album?.id ? String(t.album.id) : undefined,
          albumName: t.album?.title ?? undefined,
          previewUrl: t.preview ? `/api/preview?url=${encodeURIComponent(t.preview)}` : undefined,
        }));

        const albums: Track[] = (albumsResponse.data ?? []).map((a: DeezerAlbum) => ({
          id: String(a.id),
          name: a.title,
          artists: [a.artist?.name ?? ''],
          coverUrl: a.cover_big ?? a.cover_medium ?? '',
          type: this.mapRecordType(a.record_type),
          uri: a.link ?? '',
          artistId: a.artist?.id ? String(a.artist.id) : undefined,
        }));

        const artists: Track[] = (artistsResponse.data ?? []).map((art: DeezerArtist) => ({
          id: String(art.id),
          name: art.name,
          artists: [art.name],
          coverUrl: art.picture_big ?? art.picture_medium ?? '',
          type: 'artist' as TrackType,
          uri: art.link ?? '',
          artistId: String(art.id),
          fanCount: art.nb_fan,
          albumCount: art.nb_album,
        }));

        const all = [...artists, ...albums, ...tracks].sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();

          const aExact = aName === searchTerm ? 0 : 1;
          const bExact = bName === searchTerm ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;

          const aStarts = aName.startsWith(searchTerm) ? 0 : 1;
          const bStarts = bName.startsWith(searchTerm) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;

          const aIndex = aName.indexOf(searchTerm);
          const bIndex = bName.indexOf(searchTerm);
          return aIndex - bIndex;
        });

        return all;
      }),
    );
  }

  getArtistTracks(artistId: string, limit?: number): Observable<Track[]> {
    if (this.artistTracksCache.has(artistId)) {
      const cached = this.artistTracksCache.get(artistId)!;
      return of(limit ? cached.slice(0, limit) : cached);
    }

    return from(
      fetch(`${this.apiUrl}/artist?id=${artistId}`).then((r) => r.json()),
    ).pipe(
      map((res: DArtistTracksResponse) => {
        const tracks = (res.data ?? []).map((t: DeezerTrack) => ({
          id: String(t.id),
          name: t.title,
          artists: [t.artist?.name ?? ''],
          coverUrl: t.album?.cover_big ?? t.album?.cover_medium ?? '',
          type: 'track' as TrackType,
          uri: t.link ?? '',
          artistId: t.artist?.id ? String(t.artist.id) : undefined,
          albumId: t.album?.id ? String(t.album.id) : undefined,
          albumName: t.album?.title ?? undefined,
          previewUrl: t.preview ? `/api/preview?url=${encodeURIComponent(t.preview)}` : undefined,
        }));
        this.artistTracksCache.set(artistId, tracks);
        return limit ? tracks.slice(0, limit) : tracks;
      }),
      catchError(() => of([] as Track[])),
    );
  }

  getArtist(artistId: string): Observable<DArtistResponse> {
    if (this.artistCache.has(artistId)) {
      return of(this.artistCache.get(artistId));
    }

    return from(
      fetch(`${this.apiUrl}/artist-info?id=${artistId}`).then((r) => r.json()),
    ).pipe(
      map((res) => {
        this.artistCache.set(artistId, res);
        return res;
      }),
      catchError(() => of(null as unknown as DArtistResponse)),
    );
  }

  getArtistReleases(
    artistId: string,
    artistName: string,
  ): Observable<ReleaseItem[]> {
    return from(
      fetch(`${this.apiUrl}/artist-albums?id=${artistId}`).then((r) =>
        r.json(),
      ),
    ).pipe(
      map((res: DReleasesResponse): ReleaseItem[] =>
        (res.data ?? []).map((a: DeezerAlbum) => ({
          id: String(a.id),
          name: a.title,
          artist: artistName ?? '',
          coverUrl: a.cover_big ?? a.cover_medium ?? '',
          type: this.mapRecordType(a.record_type),
          releaseDate: a.release_date ?? '',
          previewUrl: undefined,
          artistId: a.artist?.id ? String(a.artist.id) : undefined,
        })),
      ),
      switchMap((releases: ReleaseItem[]) => {
        const singles = releases.filter((r) => r.type === 'single');
        if (singles.length === 0) return of(releases);

        const previewCalls = singles.map((s) =>
          from(
            fetch(`${this.apiUrl}/album-tracks?id=${s.id}`).then((r) =>
              r.json(),
            ),
          ).pipe(
            map((tracksRes: DAlbumTracksResponse) => ({
              id: s.id,
              previewUrl: tracksRes.data?.[0]?.preview
                ? `/api/preview?url=${encodeURIComponent(tracksRes.data[0].preview)}`
                : undefined,
            })),
            catchError(() => of({ id: s.id, previewUrl: undefined })),
          ),
        );

        return forkJoin(previewCalls).pipe(
          map((previews) => {
            const previewMap = new Map(previews.map((p) => [p.id, p.previewUrl]));
            return releases.map((r) => ({
              ...r,
              previewUrl: previewMap.get(r.id),
            }));
          }),
        );
      }),
      catchError(() => of([] as ReleaseItem[])),
    );
  }

  getArtistAlbums(artistId: string, artistName: string): Observable<ReleaseItem[]> {
    return this.getArtistReleases(artistId, artistName).pipe(
      map((releases) => releases.filter((r) => r.type === 'album')),
    );
  }

  getArtistEPs(artistId: string, artistName: string): Observable<ReleaseItem[]> {
    return this.getArtistReleases(artistId, artistName).pipe(
      map((releases) => releases.filter((r) => r.type === 'ep')),
    );
  }

  getArtistSingles(artistId: string, artistName: string): Observable<ReleaseItem[]> {
    return this.getArtistReleases(artistId, artistName).pipe(
      map((releases) => releases.filter((r) => r.type === 'single')),
    );
  }

  private mapRecordType(recordType?: string): TrackType {
    switch (recordType) {
      case 'single':
        return 'single';
      case 'ep':
        return 'ep';
      default:
        return 'album';
    }
  }

  saveSearchState(
    query: string,
    selectedTypes: Set<TrackType | 'artist'>,
    results: Track[],
  ) {
    const state = { query, selectedTypes, results };
    this.savedState.set(state);
    sessionStorage.setItem(
      'searchState',
      JSON.stringify({
        query,
        selectedTypes: Array.from(selectedTypes),
        results,
      }),
    );
  }

  getSavedSearchState() {
    let state = this.savedState();
    if (!state) {
      const stored = sessionStorage.getItem('searchState');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          state = {
            query: parsed.query,
            selectedTypes: new Set(parsed.selectedTypes),
            results: parsed.results,
          };
          this.savedState.set(state);
        } catch {}
      }
    }
    return state;
  }

  clearSearchState() {
    this.savedState.set(null);
    sessionStorage.removeItem('searchState');
  }

  getTrackPreview(trackId: string): Observable<string | undefined> {
    return from(
      fetch(`${this.apiUrl}/track?id=${trackId}`).then((r) => r.json()),
    ).pipe(
      map((res: DTrackPreviewResponse) => {
        const previewUrl = res.preview;
        return previewUrl ? `/api/preview?url=${encodeURIComponent(previewUrl)}` : undefined;
      }),
      catchError(() => of(undefined)),
    );
  }

  getAlbumTracks(albumId: string): Observable<AlbumTrack[]> {
    if (this.albumTracksCache.has(albumId)) {
      return of(this.albumTracksCache.get(albumId)!);
    }

    return from(
      fetch(`${this.apiUrl}/album-tracks?id=${albumId}`).then((r) => r.json()),
    ).pipe(
      map((res: DAlbumTracksResponse) => {
        const tracks = (res.data ?? []).map((t: DeezerTrack, index: number) => ({
          id: String(t.id),
          title: t.title,
          duration: t.duration ?? 0,
          trackNumber: index + 1,
          previewUrl: t.preview
            ? `/api/preview?url=${encodeURIComponent(t.preview)}`
            : undefined,
        }));
        this.albumTracksCache.set(albumId, tracks);
        return tracks;
      }),
      catchError(() => of([])),
    );
  }

  getAlbum(albumId: string): Observable<{
    id: string;
    name: string;
    artist: string;
    artistId?: string;
    coverUrl: string;
    type: TrackType;
    releaseDate: string;
  } | null> {
    if (this.albumCache.has(albumId)) {
      return of(this.albumCache.get(albumId));
    }

    return from(
      fetch(`${this.apiUrl}/album?id=${albumId}`).then((r) => r.json()),
    ).pipe(
      map((res: DAlbumInfoResponse) => {
        const album = {
          id: String(res.id),
          name: res.title,
          artist: res.artist?.name ?? '',
          artistId: res.artist?.id ? String(res.artist.id) : undefined,
          coverUrl: res.cover_big ?? res.cover_medium ?? '',
          type: this.mapRecordType(res.record_type),
          releaseDate: res.release_date ?? '',
        };
        this.albumCache.set(albumId, album);
        return album;
      }),
      catchError(() => of(null)),
    );
  }
}
