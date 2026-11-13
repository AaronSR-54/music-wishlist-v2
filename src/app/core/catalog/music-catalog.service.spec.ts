import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { MusicCatalogService } from './music-catalog.service';
import { Track } from '../../shared/models/track.model';

function response(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function providerOf(url: string): string {
  return /provider=([a-z]+)/.exec(url)?.[1] ?? 'deezer';
}

function track(provider: string, name = 'Song', extra: Record<string, unknown> = {}) {
  return {
    id: `${provider}:1`,
    externalId: '1',
    provider,
    name,
    artists: ['Artist'],
    coverUrl: 'https://cover',
    type: 'track',
    uri: '',
    ...extra,
  } as Track;
}

function artist(name: string, fanCount: number, albumCount = 0): Track {
  return {
    id: `deezer:${name}`,
    provider: 'deezer',
    name,
    artists: [name],
    coverUrl: '',
    type: 'artist',
    uri: '',
    fanCount,
    albumCount,
  } as Track;
}

describe('MusicCatalogService', () => {
  let service: MusicCatalogService;
  let fetchSpy: jasmine.Spy;
  let youtubeAvailable = true;

  const availability = () =>
    response({
      providers: [
        { id: 'deezer', label: 'Deezer', available: true },
        { id: 'youtube', label: 'YouTube', available: youtubeAvailable },
      ],
    });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    youtubeAvailable = true;
    TestBed.configureTestingModule({});

    fetchSpy = spyOn(globalThis, 'fetch').and.callFake(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('providers=1')) return availability();

      const provider = providerOf(url);
      if (provider === 'youtube') {
        return response({
          provider,
          data: [
            track('youtube', 'Video', {
              uri: 'https://www.youtube.com/watch?v=v1',
              artistId: 'youtube:UC1',
              coverUrl: '',
            }),
          ],
        });
      }
      if (url.includes('/search/album') || url.includes('/search/artist')) {
        return response({ provider, data: [] });
      }
      return response({
        provider,
        data: [
          track(provider, 'Song', {
            previewUrl: 'https://cdns-preview.dzcdn.net/a.mp3',
          }),
        ],
      });
    });

    service = TestBed.inject(MusicCatalogService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('loads provider availability for Deezer and YouTube only', async () => {
    const providers = await firstValueFrom(service.loadProviders());

    expect(providers.map((provider) => provider.id)).toEqual([
      'deezer',
      'youtube',
    ]);
    expect(providers.find((p) => p.id === 'deezer')?.available).toBeTrue();
    expect(providers.find((p) => p.id === 'youtube')?.available).toBeTrue();
  });

  it('keeps known providers visible when the status request fails', async () => {
    fetchSpy.and.callFake(async () => response({}, false, 500));

    const providers = await firstValueFrom(service.loadProviders());

    expect(providers.length).toBe(2);
    expect(providers.find((p) => p.id === 'deezer')?.available).toBeTrue();
    expect(providers.find((p) => p.id === 'youtube')?.available).toBeFalse();
    expect(service.videosAvailable()).toBeFalse();
  });

  it('searches only the Deezer catalog and keeps its provider ids', async () => {
    await firstValueFrom(service.loadProviders());

    const tracks = await firstValueFrom(service.search('song'));
    const urls = fetchSpy.calls.allArgs().map(([url]) => String(url));

    expect(
      urls.some((url) => url.includes('/api/search?q=song&provider=deezer')),
    ).toBeTrue();
    expect(urls.some((url) => url.includes('provider=youtube'))).toBeFalse();
    expect(urls.some((url) => url.includes('provider=itunes'))).toBeFalse();

    expect(tracks.length).toBe(1);
    expect(tracks[0].id).toBe('deezer:1');
    expect(tracks[0].provider).toBe('deezer');
    expect(tracks[0].previewUrl).toBe(
      `/api/preview?url=${encodeURIComponent('https://cdns-preview.dzcdn.net/a.mp3')}`,
    );
  });

  it('keeps distinct records that share a name in the catalog', async () => {
    fetchSpy.and.callFake(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('providers=1')) return availability();

      const provider = providerOf(url);
      if (url.includes('/search/album') || url.includes('/search/artist')) {
        return response({ provider, data: [] });
      }
      return response({
        provider,
        data: [
          track('deezer', 'Iban', { id: 'deezer:1', externalId: '1' }),
          track('deezer', 'Iban', { id: 'deezer:2', externalId: '2' }),
        ],
      });
    });

    await firstValueFrom(service.loadProviders());
    const tracks = await firstValueFrom(service.search('iban'));

    expect(tracks.map((item) => item.id)).toEqual(['deezer:1', 'deezer:2']);
  });

  it('does not include YouTube in the catalog search', async () => {
    await firstValueFrom(service.loadProviders());
    await firstValueFrom(service.search('song'));

    const urls = fetchSpy.calls.allArgs().map(([url]) => String(url));
    expect(urls.some((url) => url.includes('provider=youtube'))).toBeFalse();
  });

  it('exposes the catalog capabilities', () => {
    expect(service.capabilities().searchTypes).toEqual([
      'artist',
      'track',
      'album',
      'ep',
    ]);
    expect(service.capabilities().previews).toBeTrue();
  });

  it('searches only YouTube when the videos filter is selected', async () => {
    await firstValueFrom(service.loadProviders());
    expect(service.videosAvailable()).toBeTrue();

    const tracks = await firstValueFrom(
      service.search('song', new Set(['video'])),
    );
    const urls = fetchSpy.calls.allArgs().map(([url]) => String(url));

    expect(urls.filter((url) => url.includes('/api/search?q=song')).length).toBe(1);
    expect(urls.some((url) => url.includes('provider=youtube'))).toBeTrue();
    expect(urls.some((url) => url.includes('/search/album'))).toBeFalse();
    expect(urls.some((url) => url.includes('/search/artist'))).toBeFalse();
    expect(tracks.length).toBe(1);
    expect(tracks[0].id).toBe('youtube:1');
    expect(tracks[0].type).toBe('video');
    expect(tracks[0].artistId).toBe('youtube:UC1');
  });

  it('calls only the endpoint for the filtered type', async () => {
    await firstValueFrom(service.loadProviders());

    await firstValueFrom(service.search('song', new Set(['track'])));
    const trackCalls = fetchSpy.calls.allArgs().map(([url]) => String(url));

    expect(
      trackCalls.filter((url) => url.includes('/api/search?q=song')).length,
    ).toBe(1);
    expect(trackCalls.some((url) => url.includes('/search/album'))).toBeFalse();
    expect(trackCalls.some((url) => url.includes('/search/artist'))).toBeFalse();
    expect(trackCalls.some((url) => url.includes('provider=youtube'))).toBeFalse();

    fetchSpy.calls.reset();
    await firstValueFrom(service.search('song', new Set(['artist'])));

    const artistCalls = fetchSpy.calls.allArgs().map(([url]) => String(url));
    expect(
      artistCalls.filter((url) => url.includes('/search/artist?q=song')).length,
    ).toBe(1);
    expect(artistCalls.some((url) => url.includes('/api/search?q=song'))).toBeFalse();
    expect(artistCalls.some((url) => url.includes('/search/album'))).toBeFalse();
  });

  it('does not query YouTube when the videos filter is unavailable', async () => {
    youtubeAvailable = false;
    await firstValueFrom(service.loadProviders());

    expect(service.videosAvailable()).toBeFalse();
    const tracks = await firstValueFrom(
      service.search('song', new Set(['video'])),
    );
    const urls = fetchSpy.calls.allArgs().map(([url]) => String(url));

    expect(tracks.length).toBe(0);
    expect(urls.some((url) => url.includes('provider=youtube'))).toBeFalse();
  });

  it('ranks a followed artist above an obscure exact match', async () => {
    fetchSpy.and.callFake(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('providers=1')) return availability();

      const provider = providerOf(url);
      if (url.includes('/search/artist') && provider === 'deezer') {
        return response({
          provider,
          data: [artist('Taylor', 2, 1), artist('Taylor Swift', 12_783_270, 128)],
        });
      }
      return response({ provider, data: [] });
    });

    await firstValueFrom(service.loadProviders());
    const results = await firstValueFrom(
      service.search('taylor', new Set(['artist'])),
    );

    expect(results.map((item) => item.name)).toEqual([
      'Taylor Swift',
      'Taylor',
    ]);
  });

  it('round-trips the saved search state', async () => {
    await firstValueFrom(service.loadProviders());

    service.saveSearchState('x', new Set(['album']), [track('deezer')]);
    const state = service.getSavedSearchState();

    expect(state?.query).toBe('x');
    expect(state?.results.length).toBe(1);
    expect([...(state?.selectedTypes ?? [])]).toEqual(['album']);
  });
});
