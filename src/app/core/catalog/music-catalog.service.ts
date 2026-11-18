import { Injectable, computed, signal } from '@angular/core';
import { Observable, forkJoin, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Track, TrackType } from '../../shared/models/track.model';
import { ReleaseItem, AlbumTrack } from '../../shared/models/release-item.model';
import {
  CatalogProviderCapabilities,
  CatalogProviderId,
  CatalogProviderInfo,
  CatalogSearchFilter,
  CATALOG_CAPABILITIES,
  CATALOG_MERGE_ORDER,
  CATALOG_PROVIDER_CAPABILITIES,
  CATALOG_PROVIDER_LABELS,
  DEFAULT_CATALOG_PROVIDER,
} from '../../shared/models/catalog-provider';
import { apiUrl } from '../api/api-url';
import { parseCatalogId } from './catalog-id';
import {
  CatalogAlbumInfo,
  CatalogArtist,
  CatalogEnvelope,
  CatalogError,
  CatalogProviderStatusResponse,
} from './catalog.models';
import { normalizeCatalogItem } from './catalog-normalize';
import { mergeCatalogResults } from './catalog-merge';
import { rankCatalogResults } from './catalog-rank';

export interface CatalogSearchState {
  query: string;
  selectedTypes: Set<CatalogSearchFilter>;
  results: Track[];
}

const SEARCH_STATE_KEY = 'searchState';
const MAX_PREVIEW_ENRICHMENTS = 12;

@Injectable({ providedIn: 'root' })
export class MusicCatalogService {
  private readonly apiBase = '/api';

  private readonly _providers = signal<CatalogProviderInfo[]>([
    { id: 'deezer', label: CATALOG_PROVIDER_LABELS.deezer, available: true },
    { id: 'youtube', label: CATALOG_PROVIDER_LABELS.youtube, available: false },
  ]);
  readonly providers = this._providers.asReadonly();
  readonly availableProviders = computed(() =>
    this._providers().filter((provider) => provider.available),
  );
  readonly videosAvailable = computed(() =>
    this._providers().some(
      (provider) => provider.id === 'youtube' && provider.available,
    ),
  );
  readonly capabilities = computed<CatalogProviderCapabilities>(
    () => CATALOG_CAPABILITIES,
  );

  private providersLoaded = false;
  private readonly _providersReady = signal(false);
  /** True once the server availability check finished, so filters can be pruned safely. */
  readonly providersReady = this._providersReady.asReadonly();

  private albumCache = new Map<string, CatalogAlbumInfo>();
  private albumTracksCache = new Map<string, AlbumTrack[]>();
  private artistCache = new Map<string, CatalogArtist | null>();
  private artistTracksCache = new Map<string, Track[]>();
  private savedState = signal<CatalogSearchState | null>(null);

  loadProviders(force = false): Observable<CatalogProviderInfo[]> {
    if (this.providersLoaded && !force) return of(this._providers());
    return from(this.fetchProviders());
  }

  private async fetchProviders(): Promise<CatalogProviderInfo[]> {
    try {
      const response = await fetch(apiUrl(`${this.apiBase}/search?providers=1`));
      if (!response.ok) throw new Error(`Provider status failed: ${response.status}`);
      const body = (await response.json()) as CatalogProviderStatusResponse;
      const knownOrder: CatalogProviderId[] = ['deezer', 'youtube'];
      const statusById = new Map(
        (body.providers ?? [])
          .filter((provider) => provider?.id)
          .map((provider) => [provider.id, provider]),
      );

      const providers: CatalogProviderInfo[] = knownOrder.map((id) => {
        const status = statusById.get(id);
        return {
          id,
          label: status?.label || CATALOG_PROVIDER_LABELS[id],
          available: id === DEFAULT_CATALOG_PROVIDER || Boolean(status?.available),
        };
      });

      this._providers.set(providers);
      this.providersLoaded = true;
      this._providersReady.set(true);
      return providers;
    } catch {
      this.providersLoaded = true;
      this._providersReady.set(true);
      return this._providers();
    }
  }

  /**
   * Runs one search for the requested filters. `undefined`/empty means "no
   * filter": the Deezer catalog is queried for every kind. A single selected
   * filter makes only the calls that can produce it, so filtering fetches a
   * fresh, type-specific result list instead of trimming the previous one.
   * `video` is the only filter that queries YouTube, and it costs one call.
   */
  search(
    query: string,
    filters?: ReadonlySet<CatalogSearchFilter>,
  ): Observable<Track[]> {
    const term = encodeURIComponent(query);
    const hasFilter = Boolean(filters?.size);
    const kinds = this.resolveSearchKinds(filters);
    const requests: Observable<Track[]>[] = [];

    const catalogKinds = new Set(
      [...kinds].filter((kind): kind is Exclude<CatalogSearchFilter, 'video'> => kind !== 'video'),
    );
    const providers = this.catalogProviders();
    if (catalogKinds.size > 0 && providers.length > 0) {
      requests.push(
        forkJoin(
          providers.map((provider) =>
            this.searchProvider(provider, term, catalogKinds).pipe(
              // One catalog being down must not hide the other one.
              catchError(() => of([] as Track[])),
            ),
          ),
        ).pipe(map((groups) => mergeCatalogResults(groups))),
      );
    }

    // Videos are their own source: a YouTube search costs 100 quota units, so
    // it only runs when the videos filter is the one being asked for.
    if (kinds.has('video') && this.videosAvailable()) {
      requests.push(
        this.envelope<Track[]>(`/search?q=${term}`, 'youtube').pipe(
          map((response) =>
            (response.data ?? []).map((item) => this.toTrack(item)),
          ),
          catchError(() => of([] as Track[])),
        ),
      );
    }

    if (requests.length === 0) return of([]);

    return forkJoin(requests).pipe(
      map((groups) => groups.flat()),
      map((items) => (hasFilter ? this.applySearchFilters(items, kinds) : items)),
      map((items) => rankCatalogResults(items, query)),
    );
  }

  private resolveSearchKinds(
    filters?: ReadonlySet<CatalogSearchFilter>,
  ): Set<CatalogSearchFilter> {
    if (filters?.size) return new Set(filters);
    return new Set<CatalogSearchFilter>(CATALOG_CAPABILITIES.searchTypes);
  }

  private applySearchFilters(
    items: Track[],
    kinds: ReadonlySet<CatalogSearchFilter>,
  ): Track[] {
    return items.filter((item) =>
      kinds.has(item.type as CatalogSearchFilter),
    );
  }

  /** The searchable catalog: Deezer, and only if it is available. */
  private catalogProviders(): CatalogProviderId[] {
    const available = new Set(
      this._providers()
        .filter((provider) => provider.available)
        .map((provider) => provider.id),
    );
    return CATALOG_MERGE_ORDER.filter((provider) => available.has(provider));
  }

  private searchProvider(
    provider: CatalogProviderId,
    encodedQuery: string,
    kinds: ReadonlySet<CatalogSearchFilter>,
  ): Observable<Track[]> {
    const supported: readonly string[] =
      CATALOG_PROVIDER_CAPABILITIES[provider].searchTypes;
    const wants = (kind: CatalogSearchFilter) =>
      kinds.has(kind) && supported.includes(kind);
    const empty = (): Observable<CatalogEnvelope<Track[]>> =>
      of({ provider, data: [] });

    const wantsAlbums = wants('album') || wants('ep');
    const wantsArtists = wants('artist');
    const wantsTracks = wants('track');

    return forkJoin([
      wantsTracks
        ? this.envelope<Track[]>(`/search?q=${encodedQuery}`, provider)
        : empty(),
      wantsAlbums
        ? this.envelope<Track[]>(`/search/album?q=${encodedQuery}`, provider)
        : empty(),
      wantsArtists
        ? this.envelope<Track[]>(`/search/artist?q=${encodedQuery}`, provider)
        : empty(),
    ]).pipe(
      map(([songs, albums, artists]) => [
        ...(artists.data ?? []).map((item) => this.toTrack(item)),
        ...(albums.data ?? []).map((item) => this.toTrack(item)),
        ...(songs.data ?? []).map((item) => this.toTrack(item)),
      ]),
    );
  }

  getArtistTracks(artistId: string, limit?: number): Observable<Track[]> {
    const key = this.cacheKey(artistId);
    if (this.artistTracksCache.has(key)) {
      const cached = this.artistTracksCache.get(key)!;
      return of(limit ? cached.slice(0, limit) : cached);
    }

    const provider = this.providerOf(artistId);
    const externalId = this.externalIdOf(artistId);
    return this.envelope<Track[]>(
      `/artist?id=${encodeURIComponent(externalId)}`,
      provider,
    ).pipe(
      map((response) => {
        const tracks = (response.data ?? []).map((item) => this.toTrack(item));
        this.artistTracksCache.set(key, tracks);
        return limit ? tracks.slice(0, limit) : tracks;
      }),
    );
  }

  getArtist(artistId: string): Observable<CatalogArtist | null> {
    const key = this.cacheKey(artistId);
    if (this.artistCache.has(key)) {
      return of(this.artistCache.get(key)!);
    }

    const provider = this.providerOf(artistId);
    const externalId = this.externalIdOf(artistId);
    return this.envelope<CatalogArtist>(
      `/artist-info?id=${encodeURIComponent(externalId)}`,
      provider,
    ).pipe(
      map((response) => {
        const artist = response.data
          ? (normalizeCatalogItem(response.data) as CatalogArtist)
          : null;
        this.artistCache.set(key, artist);
        return artist;
      }),
    );
  }

  getArtistReleases(
    artistId: string,
    artistName: string,
  ): Observable<ReleaseItem[]> {
    const provider = this.providerOf(artistId);
    const externalId = this.externalIdOf(artistId);

    return this.envelope<CatalogAlbumInfo[]>(
      `/artist-albums?id=${encodeURIComponent(externalId)}&limit=100${
        artistName ? `&name=${encodeURIComponent(artistName)}` : ''
      }&dates=1`,
      provider,
    ).pipe(
      switchMap((response) => {
        const releases: ReleaseItem[] = (response.data ?? []).map((album) => {
          const normalized = normalizeCatalogItem(album);
          return {
            id: normalized.id,
            externalId: normalized.externalId,
            provider: normalized.provider,
            name: normalized.name,
            artist: artistName || normalized.artist || '',
            coverUrl: normalized.coverUrl,
            type: normalized.type as TrackType,
            releaseDate: normalized.releaseDate ?? '',
            previewUrl: undefined,
            artistId: normalized.artistId,
            uri: normalized.uri,
          };
        });

        const singles = releases
          .filter((release) => release.type === 'single' && release.provider)
          .slice(0, MAX_PREVIEW_ENRICHMENTS);

        if (singles.length === 0) return of(releases);

        const previewCalls = singles.map((single) =>
          this.envelope<AlbumTrack[]>(
            `/album-tracks?id=${encodeURIComponent(single.externalId!)}`,
            single.provider!,
          ).pipe(
            map((tracks) => ({
              id: single.id,
              previewUrl: this.previewFor(
                single.provider!,
                tracks.data?.[0]?.previewUrl,
              ),
            })),
          ),
        );

        return forkJoin(previewCalls).pipe(
          map((previews) => {
            const previewMap = new Map(previews.map((p) => [p.id, p.previewUrl]));
            return releases.map((release) => ({
              ...release,
              previewUrl: previewMap.get(release.id),
            }));
          }),
        );
      }),
    );
  }

  getArtistAlbums(artistId: string, artistName: string): Observable<ReleaseItem[]> {
    return this.getArtistReleases(artistId, artistName).pipe(
      map((releases) => releases.filter((release) => release.type === 'album')),
    );
  }

  getArtistEPs(artistId: string, artistName: string): Observable<ReleaseItem[]> {
    return this.getArtistReleases(artistId, artistName).pipe(
      map((releases) => releases.filter((release) => release.type === 'ep')),
    );
  }

  getArtistSingles(
    artistId: string,
    artistName: string,
  ): Observable<ReleaseItem[]> {
    return this.getArtistReleases(artistId, artistName).pipe(
      map((releases) => releases.filter((release) => release.type === 'single')),
    );
  }

  getTrackPreview(trackId: string): Observable<string | undefined> {
    const provider = this.providerOf(trackId);
    const externalId = this.externalIdOf(trackId);
    return this.envelope<{ previewUrl?: string }>(
      `/track?id=${encodeURIComponent(externalId)}`,
      provider,
    ).pipe(map((response) => this.previewFor(provider, response.data?.previewUrl)));
  }

  getAlbumTracks(albumId: string): Observable<AlbumTrack[]> {
    const key = this.cacheKey(albumId);
    if (this.albumTracksCache.has(key)) {
      return of(this.albumTracksCache.get(key)!);
    }

    const provider = this.providerOf(albumId);
    const externalId = this.externalIdOf(albumId);
    return this.envelope<AlbumTrack[]>(
      `/album-tracks?id=${encodeURIComponent(externalId)}`,
      provider,
    ).pipe(
      map((response) => {
        const tracks = (response.data ?? []).map((track) => {
          const normalized = normalizeCatalogItem(track);
          return {
            id: normalized.id,
            externalId: normalized.externalId,
            provider: normalized.provider,
            title: normalized.title,
            duration: normalized.duration ?? 0,
            trackNumber: normalized.trackNumber ?? 0,
            previewUrl: this.previewFor(normalized.provider, track.previewUrl),
          };
        });
        this.albumTracksCache.set(key, tracks);
        return tracks;
      }),
    );
  }

  getAlbum(albumId: string): Observable<CatalogAlbumInfo | null> {
    const key = this.cacheKey(albumId);
    if (this.albumCache.has(key)) {
      return of(this.albumCache.get(key)!);
    }

    const provider = this.providerOf(albumId);
    const externalId = this.externalIdOf(albumId);
    return this.envelope<CatalogAlbumInfo>(
      `/album?id=${encodeURIComponent(externalId)}`,
      provider,
    ).pipe(
      map((response) => {
        if (!response.data) return null;
        const normalized = normalizeCatalogItem(
          response.data,
        ) as CatalogAlbumInfo;
        const album: CatalogAlbumInfo = {
          ...normalized,
          releaseDate: normalized.releaseDate ?? '',
        };
        this.albumCache.set(key, album);
        return album;
      }),
    );
  }

  saveSearchState(
    query: string,
    selectedTypes: Set<CatalogSearchFilter>,
    results: Track[],
  ): void {
    if (!query.trim()) {
      this.clearSearchState();
      return;
    }

    const state: CatalogSearchState = { query, selectedTypes, results };
    this.savedState.set(state);
    sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({
      query,
      selectedTypes: Array.from(selectedTypes),
      results,
    }));
  }

  getSavedSearchState(): CatalogSearchState | null {
    let state = this.savedState();
    if (!state) {
      const stored = sessionStorage.getItem(SEARCH_STATE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          state = {
            query: parsed.query,
            selectedTypes: new Set(parsed.selectedTypes ?? []),
            results: parsed.results ?? [],
          };
          this.savedState.set(state);
        } catch {
          return null;
        }
      }
    }

    return state ?? null;
  }

  clearSearchState(): void {
    this.savedState.set(null);
    sessionStorage.removeItem(SEARCH_STATE_KEY);
  }

  private envelope<T>(
    path: string,
    provider: CatalogProviderId,
  ): Observable<CatalogEnvelope<T>> {
    return from(this.fetchEnvelope<T>(path, provider));
  }

  private async fetchEnvelope<T>(
    path: string,
    provider: CatalogProviderId,
  ): Promise<CatalogEnvelope<T>> {
    const separator = path.includes('?') ? '&' : '?';
    const url = apiUrl(
      `${this.apiBase}${path}${separator}provider=${encodeURIComponent(provider)}&format=neutral`,
    );
    const response = await fetch(url);
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new CatalogError(
        body?.error ?? `Catalog request failed: ${response.status}`,
        body?.code,
        body?.provider ?? provider,
        response.status,
      );
    }

    return body as CatalogEnvelope<T>;
  }

  private toTrack(raw: Track): Track {
    const normalized = normalizeCatalogItem(raw);
    // YouTube results are videos: a distinct type keeps them apart from the
    // same song in the merged catalog (and from album/EP dedupe).
    const type =
      normalized.provider === 'youtube'
        ? 'video'
        : (normalized.type ?? 'track');
    return {
      ...normalized,
      type: type as TrackType,
      previewUrl: this.previewFor(normalized.provider, raw.previewUrl),
    };
  }

  private previewFor(
    provider: CatalogProviderId,
    rawPreviewUrl: string | undefined,
  ): string | undefined {
    if (!rawPreviewUrl) return undefined;
    if (provider === 'deezer') {
      return apiUrl(`/api/preview?url=${encodeURIComponent(rawPreviewUrl)}`);
    }
    return rawPreviewUrl;
  }

  private providerOf(value: string): CatalogProviderId {
    return parseCatalogId(value)?.provider ?? DEFAULT_CATALOG_PROVIDER;
  }

  private externalIdOf(value: string): string {
    return parseCatalogId(value)?.externalId ?? value;
  }

  private cacheKey(value: string): string {
    const parsed = parseCatalogId(value);
    return parsed ? `${parsed.provider}:${parsed.externalId}` : value;
  }
}
