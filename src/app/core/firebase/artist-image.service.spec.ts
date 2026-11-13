import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';

import { ArtistImageService } from './artist-image.service';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { LanguageService } from '../i18n/language.service';

describe('ArtistImageService', () => {
  let service: ArtistImageService;
  const uid = 'user-1';
  const user = { uid, displayName: 'User' } as User;
  const photo = 'data:image/jpeg;base64,AAAA';

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
              photoSaved: 'saved',
              photoRemoved: 'removed',
              toastError: 'error',
              toastErrorPlural: 'errors',
            }),
          },
        },
      ],
    });
    service = TestBed.inject(ArtistImageService);
    service.initListener(uid);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('stores a custom photo in demo mode', async () => {
    const saved = await service.setImage('deezer:27', photo, user);

    expect(saved).toBeTrue();
    expect(service.imageFor('deezer:27')).toBe(photo);
    expect(service.imageFor('27')).toBe(photo);
    expect(service.resolve('deezer:27', 'deezer-photo')).toBe(photo);

    const stored = JSON.parse(
      localStorage.getItem(`artist-images-${uid}`) ?? '{}',
    );
    expect(stored['deezer:27']).toBe(photo);
  });

  it('falls back to the catalog photo when there is no override', () => {
    expect(service.imageFor('deezer:28')).toBeNull();
    expect(service.resolve('deezer:28', 'deezer-photo')).toBe('deezer-photo');
    expect(service.hasOverride('deezer:28')).toBeFalse();
  });

  it('removes the override and restores the Deezer photo', async () => {
    await service.setImage('deezer:27', photo, user);
    const removed = await service.clearImage('deezer:27');

    expect(removed).toBeTrue();
    expect(service.imageFor('deezer:27')).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(`artist-images-${uid}`) ?? '{}'),
    ).toEqual({});
  });
});
