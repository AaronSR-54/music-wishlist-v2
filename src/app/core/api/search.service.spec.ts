import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let originalBase: string;
  let fetchSpy: jasmine.Spy;

  const previewUrl = 'https://cdns-preview.dzcdn.net/1.mp3';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SearchService);
    originalBase = environment.apiBaseUrl;

    fetchSpy = spyOn(globalThis, 'fetch').and.callFake(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/artist-info')
        ? {
            provider: 'deezer',
            data: {
              id: 'deezer:2',
              externalId: '2',
              provider: 'deezer',
              name: 'Artist',
              coverUrl: 'https://img/2',
            },
          }
        : url.includes('/search?')
          ? {
              provider: 'deezer',
              data: [
                {
                  id: 'deezer:1',
                  externalId: '1',
                  provider: 'deezer',
                  name: 'Song',
                  artists: ['Artist'],
                  coverUrl: 'https://cover/1',
                  type: 'track',
                  uri: '',
                  previewUrl,
                },
              ],
            }
          : { provider: 'deezer', data: [] };
      return { ok: true, status: 200, json: async () => body } as Response;
    });
  });

  afterEach(() => {
    environment.apiBaseUrl = originalBase;
    localStorage.clear();
  });

  function calledUrls(): string[] {
    return fetchSpy.calls.allArgs().map((args) => String(args[0]));
  }

  it('prefixes neutral catalog and preview URLs with the base URL on native', async () => {
    environment.apiBaseUrl = 'https://music-wishlist-v2.vercel.app';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);

    const tracks = await firstValueFrom(service.search('test'));

    expect(calledUrls()).toContain(
      'https://music-wishlist-v2.vercel.app/api/search?q=test&provider=deezer&format=neutral',
    );
    expect(tracks[0].previewUrl).toBe(
      `https://music-wishlist-v2.vercel.app/api/preview?url=${encodeURIComponent(previewUrl)}`,
    );
  });

  it('keeps catalog and preview URLs origin-relative on the web', async () => {
    environment.apiBaseUrl = 'https://music-wishlist-v2.vercel.app';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);

    const tracks = await firstValueFrom(service.search('test'));

    expect(calledUrls()).toContain('/api/search?q=test&provider=deezer&format=neutral');
    expect(tracks[0].previewUrl).toBe(
      `/api/preview?url=${encodeURIComponent(previewUrl)}`,
    );
  });

  it('returns the neutral artist model', async () => {
    const artist = await firstValueFrom(service.getArtist('deezer:2'));
    expect(artist?.coverUrl).toBe('https://img/2');
    expect(artist?.name).toBe('Artist');
  });

  it('defaults legacy ids to Deezer', async () => {
    await firstValueFrom(service.getArtistTracks('2', 5));
    expect(calledUrls()).toContain('/api/artist?id=2&provider=deezer&format=neutral');
  });
});
