import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';
import { of } from 'rxjs';

import { FavoriteArtistsService } from './favorite-artists.service';
import { SearchService } from '../api/search.service';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { LanguageService } from '../i18n/language.service';

describe('FavoriteArtistsService provider identity', () => {
  let service: FavoriteArtistsService;
  const uid = 'user-1';

  const user = {
    uid,
    displayName: 'User',
    email: 'user@example.com',
  } as User;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: SearchService, useValue: { getArtist: () => of(null) } },
        { provide: AuthService, useValue: { demoMode: () => true } },
        {
          provide: ToastService,
          useValue: { success: () => undefined, error: () => undefined },
        },
        {
          provide: LanguageService,
          useValue: {
            t: () => ({
              toastFavoriteAdded: 'added',
              toastFavoriteAddedPlural: 'added',
              toastFavoriteRemoved: 'removed',
              toastFavoriteRemovedPlural: 'removed',
              toastError: 'error',
              toastErrorPlural: 'error',
            }),
          },
        },
      ],
    });
    service = TestBed.inject(FavoriteArtistsService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('normalizes legacy favorites as Deezer on read', () => {
    localStorage.setItem(
      `favorite-artists-${uid}`,
      JSON.stringify([
        {
          id: 'doc-1',
          artistId: '27',
          name: 'Daft Punk',
          addedAt: 1,
          addedBy: 'U',
          addedByUid: uid,
        },
      ]),
    );

    service.initListener(uid);

    const artist = service.artists()[0];
    expect(artist.artistId).toBe('deezer:27');
    expect(artist.provider).toBe('deezer');
    expect(artist.externalId).toBe('27');
  });

  it('persists the provider when adding a YouTube artist', async () => {
    service.initListener(uid);

    await service.add('youtube:abc', 'Artist', undefined, user);

    const stored = JSON.parse(
      localStorage.getItem(`favorite-artists-${uid}`) ?? '[]',
    );
    expect(stored[0].artistId).toBe('youtube:abc');
    expect(stored[0].provider).toBe('youtube');
    expect(stored[0].externalId).toBe('abc');
  });
});
