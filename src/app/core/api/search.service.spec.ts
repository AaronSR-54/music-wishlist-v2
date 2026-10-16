import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let originalBase: string;
  let fetchSpy: jasmine.Spy;

  const previewUrl = 'https://cdns-preview.example/1.mp3';

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SearchService);
    originalBase = environment.apiBaseUrl;

    fetchSpy = spyOn(globalThis, 'fetch').and.callFake(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/search?')
        ? {
            data: [
              {
                id: 1,
                title: 'Song',
                link: 'https://deezer.com/track/1',
                preview: previewUrl,
                artist: { id: 2, name: 'Artist' },
                album: { id: 3, title: 'Album', cover_big: 'https://cover/1' },
              },
            ],
          }
        : { data: [] };
      return { ok: true, json: async () => body } as Response;
    });
  });

  afterEach(() => {
    environment.apiBaseUrl = originalBase;
  });

  function calledUrls(): string[] {
    return fetchSpy.calls.allArgs().map((args) => String(args[0]));
  }

  it('prefixes data and preview URLs with the base URL on a native platform', async () => {
    environment.apiBaseUrl = 'https://music-wishlist-v2.vercel.app';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);

    const tracks = await firstValueFrom(service.search('test'));

    expect(calledUrls()).toContain(
      'https://music-wishlist-v2.vercel.app/api/search?q=test',
    );
    expect(tracks[0].previewUrl).toBe(
      `https://music-wishlist-v2.vercel.app/api/preview?url=${encodeURIComponent(previewUrl)}`,
    );
  });

  it('keeps data and preview URLs origin-relative on the web', async () => {
    environment.apiBaseUrl = 'https://music-wishlist-v2.vercel.app';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);

    const tracks = await firstValueFrom(service.search('test'));

    expect(calledUrls()).toContain('/api/search?q=test');
    expect(tracks[0].previewUrl).toBe(
      `/api/preview?url=${encodeURIComponent(previewUrl)}`,
    );
  });
});
