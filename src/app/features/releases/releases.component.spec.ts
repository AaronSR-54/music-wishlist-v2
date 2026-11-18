import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { FavoritesService } from '../../core/firebase/favorites.service';
import { ArtistMergeService } from '../../core/firebase/artist-merge.service';
import { WishlistService } from '../../core/firebase/wishlist.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { ReleasesComponent } from './releases.component';

describe('ReleasesComponent', () => {
  let originalBase: string;
  let fetchSpy: jasmine.Spy;

  const previewUrl = 'https://cdns-preview.example/1.mp3';

  beforeEach(() => {
    localStorage.clear();
    originalBase = environment.apiBaseUrl;
    sessionStorage.removeItem('releasesCache');

    TestBed.configureTestingModule({
      providers: [
        { provide: FavoritesService, useValue: { favorites: signal([]) } },
        {
          provide: ArtistMergeService,
          useValue: {
            merges: signal([]),
            resolveId: (id: string) => id,
            groupIds: (id: string) => [id],
            nameOf: () => '',
          },
        },
        { provide: WishlistService, useValue: { entries: () => [] } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: LanguageService, useValue: { t: () => ({}) } },
        { provide: Router, useValue: {} },
        { provide: ToastService, useValue: { error: () => undefined } },
      ],
    });

    fetchSpy = spyOn(globalThis, 'fetch').and.callFake(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/artist-albums')
        ? {
            provider: 'deezer',
            data: [
              {
                id: 'deezer:1',
                externalId: '1',
                provider: 'deezer',
                name: 'Single',
                type: 'single',
                releaseDate: '2026-01-15',
                coverUrl: '',
                artist: 'A',
                artistId: 'deezer:9',
              },
            ],
          }
        : url.includes('/album-tracks')
          ? {
              provider: 'deezer',
              data: [
                {
                  id: 'deezer:5',
                  externalId: '5',
                  provider: 'deezer',
                  title: 'S',
                  duration: 180,
                  trackNumber: 1,
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

  function createComponent(): ReleasesComponent {
    return TestBed.runInInjectionContext(() => new ReleasesComponent());
  }

  function calledUrls(): string[] {
    return fetchSpy.calls.allArgs().map((args) => String(args[0]));
  }

  it('prefixes neutral release requests and preview URLs on a native platform', async () => {
    environment.apiBaseUrl = 'https://music-wishlist-v2.vercel.app';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    const component = createComponent() as any;

    component.loadReleases(2026, 0, [{ artistId: '42', name: 'A' }]);
    await new Promise((resolve) => setTimeout(resolve));

    expect(calledUrls()).toContain(
      'https://music-wishlist-v2.vercel.app/api/artist-albums?id=42&limit=100&name=A&provider=deezer&format=neutral',
    );
    expect(calledUrls()).toContain(
      'https://music-wishlist-v2.vercel.app/api/album-tracks?id=1&provider=deezer&format=neutral',
    );
  });

  it('keeps release requests origin-relative on the web', async () => {
    environment.apiBaseUrl = 'https://music-wishlist-v2.vercel.app';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    const component = createComponent() as any;

    component.loadReleases(2026, 0, [{ artistId: '42', name: 'A' }]);
    await new Promise((resolve) => setTimeout(resolve));

    expect(calledUrls()).toContain(
      '/api/artist-albums?id=42&limit=100&name=A&provider=deezer&format=neutral',
    );
  });
});
