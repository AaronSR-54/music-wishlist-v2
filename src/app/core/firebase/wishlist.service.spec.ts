import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Firestore } from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';

import { WishlistService } from './wishlist.service';
import { WishlistShareService } from './wishlist-share.service';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { LanguageService } from '../i18n/language.service';
import { Track } from '../../shared/models/track.model';

describe('WishlistService provider identity', () => {
  let service: WishlistService;
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
        { provide: HttpClient, useValue: {} },
        {
          provide: WishlistShareService,
          useValue: { sharesReceived: () => [], sharesGiven: () => [] },
        },
        { provide: AuthService, useValue: { demoMode: () => true } },
        {
          provide: ToastService,
          useValue: { success: () => undefined, error: () => undefined },
        },
        {
          provide: LanguageService,
          useValue: {
            t: () => ({
              toastAddedToWishlist: 'added',
              toastAddedToWishlistPlural: 'added',
              toastError: 'error',
              toastErrorPlural: 'error',
            }),
          },
        },
      ],
    });
    service = TestBed.inject(WishlistService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('normalizes legacy documents as Deezer on read', () => {
    localStorage.setItem(
      `wishlist-${uid}`,
      JSON.stringify([
        {
          id: 'doc-1',
          trackId: '123',
          name: 'Legacy',
          artist: 'A',
          coverUrl: '',
          type: 'track',
          addedAt: 1,
          addedBy: 'U',
          addedByUid: uid,
          downloaded: false,
        },
      ]),
    );

    service.initListener(uid, 'user@example.com');

    const entry = service.entries()[0];
    expect(entry.trackId).toBe('deezer:123');
    expect(entry.provider).toBe('deezer');
    expect(entry.externalId).toBe('123');
  });

  it('keeps the same external id from two providers distinct', () => {
    localStorage.setItem(
      `wishlist-${uid}`,
      JSON.stringify([
        {
          id: 'doc-1',
          trackId: 'deezer:5',
          provider: 'deezer',
          externalId: '5',
          name: 'Deezer item',
          artist: 'A',
          coverUrl: '',
          type: 'track',
          addedAt: 2,
          addedBy: 'U',
          addedByUid: uid,
          downloaded: false,
        },
        {
          id: 'doc-2',
          trackId: 'youtube:5',
          provider: 'youtube',
          externalId: '5',
          name: 'YouTube item',
          artist: 'A',
          coverUrl: '',
          type: 'track',
          addedAt: 1,
          addedBy: 'U',
          addedByUid: uid,
          downloaded: false,
        },
      ]),
    );

    service.initListener(uid, 'user@example.com');

    expect(service.entries().length).toBe(2);
    expect(service.trackIds().has('deezer:5')).toBeTrue();
    expect(service.trackIds().has('youtube:5')).toBeTrue();
  });

  it('persists the provider when adding a YouTube track', async () => {
    service.initListener(uid, 'user@example.com');

    const track: Track = {
      id: 'youtube:abc',
      externalId: 'abc',
      provider: 'youtube',
      name: 'Song',
      artists: ['Artist'],
      coverUrl: '',
      type: 'track',
      uri: '',
      artistId: 'youtube:artist-1',
      albumId: 'youtube:album-1',
    };

    await service.add(track, user);

    const stored = JSON.parse(localStorage.getItem(`wishlist-${uid}`) ?? '[]');
    expect(stored[0].trackId).toBe('youtube:abc');
    expect(stored[0].provider).toBe('youtube');
    expect(stored[0].externalId).toBe('abc');
    expect(stored[0].artistId).toBe('youtube:artist-1');
  });
});
