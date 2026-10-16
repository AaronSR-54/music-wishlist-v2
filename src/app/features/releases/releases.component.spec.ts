import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { FavoritesService } from '../../core/firebase/favorites.service';
import { WishlistService } from '../../core/firebase/wishlist.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { ReleaseItem } from '../../shared/models/release-item.model';
import { ReleasesComponent } from './releases.component';

describe('ReleasesComponent', () => {
  let originalBase: string;
  let fetchSpy: jasmine.Spy;

  const previewUrl = 'https://cdns-preview.example/1.mp3';

  beforeEach(() => {
    originalBase = environment.apiBaseUrl;
    sessionStorage.removeItem('releasesCache');

    TestBed.configureTestingModule({
      providers: [
        { provide: FavoritesService, useValue: { favorites: signal([]) } },
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
            data: [
              {
                id: 1,
                title: 'Single',
                record_type: 'single',
                release_date: '2026-01-15',
                artist: { id: 9 },
              },
            ],
          }
        : url.includes('/album-tracks')
          ? { data: [{ preview: previewUrl }] }
          : { data: [] };
      return { ok: true, json: async () => body } as Response;
    });
  });

  afterEach(() => {
    environment.apiBaseUrl = originalBase;
  });

  function createComponent(): ReleasesComponent {
    return TestBed.runInInjectionContext(() => new ReleasesComponent());
  }

  function calledUrls(): string[] {
    return fetchSpy.calls.allArgs().map((args) => String(args[0]));
  }

  it('prefixes release data and preview URLs with the base URL on a native platform', async () => {
    environment.apiBaseUrl = 'https://music-wishlist-v2.vercel.app';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    const component = createComponent() as any;

    component.loadReleases(2026, 0, [{ artistId: '42', name: 'A' }]);
    expect(calledUrls()).toContain(
      'https://music-wishlist-v2.vercel.app/api/artist-albums?id=42&limit=100',
    );

    const single: ReleaseItem = {
      id: '5',
      name: 'S',
      artist: 'A',
      coverUrl: '',
      type: 'single',
      releaseDate: '2026-01-15',
    };
    const releases = (await firstValueFrom(
      component.withPreviews([single]),
    )) as ReleaseItem[];

    expect(calledUrls()).toContain(
      'https://music-wishlist-v2.vercel.app/api/album-tracks?id=5',
    );
    expect(releases[0].previewUrl).toBe(
      `https://music-wishlist-v2.vercel.app/api/preview?url=${encodeURIComponent(previewUrl)}`,
    );
  });

  it('keeps release data and preview URLs origin-relative on the web', async () => {
    environment.apiBaseUrl = 'https://music-wishlist-v2.vercel.app';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    const component = createComponent() as any;

    component.loadReleases(2026, 0, [{ artistId: '42', name: 'A' }]);
    expect(calledUrls()).toContain('/api/artist-albums?id=42&limit=100');

    const single: ReleaseItem = {
      id: '5',
      name: 'S',
      artist: 'A',
      coverUrl: '',
      type: 'single',
      releaseDate: '2026-01-15',
    };
    const releases = (await firstValueFrom(
      component.withPreviews([single]),
    )) as ReleaseItem[];

    expect(releases[0].previewUrl).toBe(
      `/api/preview?url=${encodeURIComponent(previewUrl)}`,
    );
  });
});
