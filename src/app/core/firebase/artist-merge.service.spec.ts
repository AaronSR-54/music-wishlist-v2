import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';

import { ArtistMergeService } from './artist-merge.service';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { LanguageService } from '../i18n/language.service';

describe('ArtistMergeService', () => {
  let service: ArtistMergeService;
  const uid = 'user-1';
  const user = { uid, displayName: 'User' } as User;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { demoMode: () => true } },
        {
          provide: ToastService,
          useValue: { success: () => undefined, error: () => undefined },
        },
        {
          provide: LanguageService,
          useValue: {
            t: () => ({
              mergeSameArtist: 'same',
              mergeSuccess: 'merged',
              mergeSuccessPlural: 'merged',
              unmergeSuccess: 'split',
              toastError: 'error',
              toastErrorPlural: 'errors',
            }),
          },
        },
      ],
    });
    service = TestBed.inject(ArtistMergeService);
    service.initListener(uid);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolves an alias to the primary artist', async () => {
    const merged = await service.merge(
      { artistId: 'deezer:105607162', name: 'Iban' },
      { artistId: 'deezer:999', name: 'Iban split' },
      user,
    );

    expect(merged).toBeTrue();
    expect(service.resolveId('deezer:999')).toBe('deezer:105607162');
    expect(service.groupIds('deezer:105607162')).toEqual([
      'deezer:105607162',
      'deezer:999',
    ]);
    expect(service.nameOf('deezer:999')).toBe('Iban split');
  });

  it('stores merges in demo mode', async () => {
    await service.merge(
      { artistId: '27', name: 'Daft Punk' },
      { artistId: '28', name: 'Daft Punk duplicate' },
      user,
    );

    const stored = JSON.parse(
      localStorage.getItem(`artist-merges-${uid}`) ?? '[]',
    );
    expect(stored.length).toBe(1);
    expect(stored[0].primaryArtistId).toBe('deezer:27');
    expect(stored[0].aliasArtistId).toBe('deezer:28');
  });

  it('re-parents the aliases of the artist being merged', async () => {
    await service.merge(
      { artistId: 'deezer:c', name: 'C' },
      { artistId: 'deezer:d', name: 'D' },
      user,
    );
    await service.merge(
      { artistId: 'deezer:a', name: 'A' },
      { artistId: 'deezer:c', name: 'C' },
      user,
    );

    expect(new Set(service.groupIds('deezer:a'))).toEqual(
      new Set(['deezer:a', 'deezer:c', 'deezer:d']),
    );
    expect(service.resolveId('deezer:d')).toBe('deezer:a');
  });

  it('refuses to merge an artist with itself', async () => {
    const merged = await service.merge(
      { artistId: 'deezer:1', name: 'One' },
      { artistId: 'deezer:1', name: 'One' },
      user,
    );

    expect(merged).toBeFalse();
    expect(service.merges().length).toBe(0);
  });

  it('can undo one alias or the whole group', async () => {
    await service.merge(
      { artistId: 'deezer:1', name: 'One' },
      { artistId: 'deezer:2', name: 'Two' },
      user,
    );
    await service.merge(
      { artistId: 'deezer:1', name: 'One' },
      { artistId: 'deezer:3', name: 'Three' },
      user,
    );

    await service.unmerge('deezer:2');
    expect(service.groupIds('deezer:1')).toEqual(['deezer:1', 'deezer:3']);

    await service.unmergeGroup('deezer:1');
    expect(service.groupIds('deezer:1')).toEqual(['deezer:1']);
  });
});
