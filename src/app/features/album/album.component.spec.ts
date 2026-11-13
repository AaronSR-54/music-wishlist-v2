import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { Location } from '@angular/common';
import { of } from 'rxjs';

import { AlbumComponent } from './album.component';
import { SearchService } from '../../core/api/search.service';
import { WishlistService } from '../../core/firebase/wishlist.service';
import { AuthService } from '../../core/auth/auth.service';
import { PreviewService } from '../../core/services/preview.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ToastService } from '../../shared/components/toast/toast.component';

describe('AlbumComponent provider routes', () => {
  let getAlbum: jasmine.Spy;

  beforeEach(() => {
    getAlbum = jasmine.createSpy('getAlbum').and.returnValue(of(null));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'youtube:abc' })),
            queryParamMap: of(convertToParamMap({})),
          },
        },
        { provide: Router, useValue: { navigate: () => undefined, events: of() } },
        { provide: Location, useValue: { back: () => undefined } },
        {
          provide: SearchService,
          useValue: {
            getAlbum,
            getAlbumTracks: () => of([]),
          },
        },
        { provide: WishlistService, useValue: { entries: () => [] } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: PreviewService, useValue: {} },
        { provide: LanguageService, useValue: { t: () => ({}) } },
        {
          provide: ToastService,
          useValue: { success: () => undefined, error: () => undefined },
        },
      ],
    });
  });

  it('passes a provider-scoped id to the catalog and shows not-found when missing', () => {
    const component = TestBed.runInInjectionContext(
      () => new AlbumComponent(),
    ) as any;

    component.loadAlbum('youtube:abc');

    expect(getAlbum).toHaveBeenCalledWith('youtube:abc');
    expect(component.notFound()).toBeTrue();
  });
});
