import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SearchService } from '../../core/api/search.service';
import { WishlistService } from '../../core/firebase/wishlist.service';
import { FavoriteArtistsService } from '../../core/firebase/favorite-artists.service';
import { AuthService } from '../../core/auth/auth.service';
import { PreviewService } from '../../core/services/preview.service';
import { Track } from '../../shared/models/track.model';
import { ReleaseItem } from '../../shared/models/release-item.model';
import { CoverComponent } from '../../shared/components/cover/cover.component';
import { SearchResultItemComponent } from '../../shared/components/search-result-item/search-result-item.component';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { IconComponent } from '../../shared/icons/icon.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { formatFans } from '../../shared/utils/format-fans';
import { LanguageService } from '../../core/i18n/language.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ArtistCacheService } from '../../core/services/artist-cache.service';

@Component({
  selector: 'app-artist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CoverComponent,
    SearchResultItemComponent,
    SpinnerComponent,
    IconComponent,
    PageHeaderComponent,
    ButtonComponent,
  ],
  styles: `
    @keyframes popIn {
      0% {
        opacity: 0;
        transform: scale(0.8);
      }
      50% {
        opacity: 1;
      }
      100% {
        transform: scale(1);
      }
    }
    .btn-pop-in {
      animation: popIn 220ms var(--ease-smooth) both;
    }
    .scroll-fade {
      flex: 1;
      overflow-y: auto;
      scrollbar-width: none;
      padding-bottom: 2rem;
      padding-top: 4px;
      -webkit-mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 16px,
        black 95%,
        transparent 100%
      );
      mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 16px,
        black 95%,
        transparent 100%
      );
    }
    .scroll-fade::-webkit-scrollbar {
      display: none;
    }
    @keyframes releaseScale {
      0% {
        opacity: 0;
        transform: scale(0.9);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }
    .release-item {
      animation: releaseScale 400ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    /* Cover: cinematográfico — zoom out desde cerca */
    .artist-cover {
      animation: coverZoomOut 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    /* Nombre: entra suave desde abajo */
    .artist-name {
      animation: rowEnter 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: 60ms;
    }
    /* Stats: deriva suave más tarde */
    .artist-meta {
      animation: driftUp 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: 140ms;
    }
    /* Sección de tracks: aparece por último */
    .tracks-section {
      animation: driftUp 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: 220ms;
    }
  `,
  template: `
    <div class="flex flex-col h-full overflow-hidden p-0.5 pt-2 gap-4">
      <app-page-header
        prefix="02.a/"
        [title]="t().artist"
        [backLabel]="t().back"
        (back)="goBack()"
      />

      <div class="scroll-fade flex flex-col p-2 gap-16">
        <div
          class="flex gap-2 max-md:flex-col max-md:items-center md:gap-8 max-md:text-center mt-4"
        >
          <div
            class="shrink-0 w-[200px] h-[200px] rounded-md overflow-hidden max-md:w-full max-md:h-auto max-md:aspect-square shadow-ink/5 shadow-lg artist-cover"
          >
            @if (artist(); as a) {
              <app-cover [name]="a.name" [coverUrl]="a.picture_big" />
            }
          </div>

          <div class="flex-1 flex flex-col justify-start">
            @if (artist(); as a) {
              <div class="flex flex-col text-ink dark:text-bone">
                <div class="flex items-center gap-4 mb-5 artist-name">
                  <h1
                    class="m-0 text-[2rem] md:text-[4rem] font-bold font-display flex-1"
                  >
                    {{ a.name }}
                  </h1>
                  <button
                    class="[&.active]:btn-pop-in w-9 h-9 md:w-12 md:h-12 rounded-full cursor-pointer flex items-center justify-center text-ink-600 dark:text-bone-600 shrink-0 bg-transparent p-0 transition-[color,transform] duration-fast ease-smooth hover:scale-[1.05] active:scale-[0.88]"
                    [class.active]="isArtistInWishlist(a.id)"
                    (click)="toggleArtist($event)"
                    [title]="
                      isArtistInWishlist(a.id)
                        ? 'Quitar de wishlist'
                        : 'Añadir a wishlist'
                    "
                  >
                    @if (isArtistInWishlist(a.id)) {
                      <app-icon
                        name="heart-filled"
                        class="w-8 h-8 md:w-12 md:h-12"
                      />
                    } @else {
                      <app-icon name="heart" class="w-8 h-8 md:w-12 md:h-12" />
                    }
                  </button>
                </div>

                <div
                  class="flex gap-[30px] mb-5 max-md:justify-center artist-meta"
                >
                  @if (a.nb_fan !== undefined) {
                    <div class="flex flex-col gap-1">
                      <span
                        class="font-display italic text-xs md:text-base text-ink-700 dark:text-bone-700 uppercase tracking-[0.5px]"
                        >{{ t().followers }}</span
                      >
                      <span class="text-lg md:text-[1.375rem] font-bold">{{
                        formatFans(a.nb_fan)
                      }}</span>
                    </div>
                  }
                  @if (a.nb_album !== undefined) {
                    <div class="flex flex-col gap-1">
                      <span
                        class="font-display italic text-xs md:text-base text-ink-700 dark:text-bone-700 uppercase tracking-[0.5px]"
                        >{{ t().albums2 }}</span
                      >
                      <span class="text-lg md:text-[1.375rem] font-bold">{{
                        a.nb_album
                      }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <div class="flex flex-col gap-4 tracks-section">
          <h2
            class="font-body text-xs md:text-base text-ink-700 dark:text-bone-700 font-semibold tracking-[0.05em] uppercase m-0"
          >
            {{ t().popularSongs }}
          </h2>

          @if (loading()) {
            <div
              class="flex flex-col items-center gap-4 py-10 px-5 text-ink-600 dark:text-bone-600 text-center [animation:fadeIn_300ms_var(--ease)_both]"
            >
              <app-spinner size="md" />
              <span class="text-sm md:text-lg italic">{{
                t().loadingSongs
              }}</span>
            </div>
          } @else if (tracks().length === 0) {
            <div
              class="text-center py-10 px-5 text-ink-700 dark:text-bone-700 text-sm md:text-lg [animation:fadeIn_300ms_var(--ease)_both]"
            >
              {{ t().noSongsAvailable }}
            </div>
          } @else {
            <div class="flex flex-col">
              @for (track of tracks(); track track.id; let i = $index) {
                <app-search-result-item
                  [style.animation]="
                    'trackLeft 450ms cubic-bezier(0.16,1,0.3,1) both'
                  "
                  [style.animation-delay]="i * 35 + 'ms'"
                  [item]="track"
                  type="track"
                  [isAdded]="isInWishlist(track.id)"
                  [showAddButton]="true"
                  [showTypeChip]="false"
                  (onAddClick)="toggle($event)"
                  (onPlayClick)="onTrackPlayClicked($event)"
                />
              }
            </div>
          }
        </div>

        @if (loadingReleases()) {
          <div
            class="flex flex-col items-center gap-4 py-10 px-5 text-ink-600 dark:text-bone-600 text-center [animation:fadeIn_300ms_var(--ease)_both]"
          >
            <app-spinner size="md" />
            <span class="text-sm md:text-lg italic">{{ t().loadingReleases }}</span>
          </div>
        } @else {
          @for (section of releaseSections(); track section.title) {
            <div class="flex flex-col gap-4">
              <h2
                class="font-body text-xs md:text-base text-ink-700 dark:text-bone-700 font-semibold tracking-[0.05em] uppercase m-0"
              >
                {{ section.title }}
              </h2>
              <div class="grid grid-cols-3 md:grid-cols-4 gap-2 gap-y-3">
                @for (item of section.items; track item.id; let i = $index) {
                  <div
                    class="flex flex-col gap-1 group release-item"
                    [style.animation-delay]="i * 40 + 'ms'"
                  >
                    <div
                      class="w-full aspect-square rounded-md overflow-hidden bg-ink-100 dark:bg-ink-800 cursor-pointer relative"
                      (click)="navigateToAlbum(item.id)"
                    >
                      <app-cover [name]="item.name" [coverUrl]="item.coverUrl" />
                      <div
                        class="absolute top-1 right-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      >
                        <button
                          appBtn
                          variant="add"
                          [added]="isInWishlist(item.id)"
                          (click)="toggleReleaseWishlist($event, item)"
                          class="max-md:w-8 max-md:h-8 shadow-md border border-solid border-ink-200"
                        >
                          <app-icon
                            [name]="isInWishlist(item.id) ? 'check' : 'plus'"
                            class="w-4 h-4 md:w-5 md:h-5"
                          />
                        </button>
                      </div>
                    </div>
                    <div class="flex flex-col">
                      <h3
                        class="text-sm font-semibold text-ink dark:text-bone line-clamp-1 cursor-pointer hover:opacity-75"
                        (click)="navigateToAlbum(item.id)"
                      >
                        {{ item.name }}
                      </h3>
                      @if (item.releaseDate) {
                        <p class="text-xs text-ink-600 dark:text-bone-600">
                          {{ item.releaseDate | slice: 0 : 4 }}
                        </p>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class ArtistComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private searchSvc = inject(SearchService);
  private wishlistSvc = inject(WishlistService);
  private favoriteArtistsSvc = inject(FavoriteArtistsService);
  private authSvc = inject(AuthService);
  private previewSvc = inject(PreviewService);
  private languageService = inject(LanguageService);
  private destroyRef = inject(DestroyRef);
  private artistCacheSvc = inject(ArtistCacheService);

  t = computed(() => this.languageService.t());

  artist = signal<any>(null);
  tracks = signal<Track[]>([]);
  albums = signal<ReleaseItem[]>([]);
  eps = signal<ReleaseItem[]>([]);
  singles = signal<ReleaseItem[]>([]);
  loading = signal(true);
  loadingReleases = signal(false);

  releaseSections = computed(() =>
    [
      { title: 'Albums', items: this.albums() },
      { title: 'EPs', items: this.eps() },
      { title: 'Singles', items: this.singles() },
    ].filter((s) => s.items.length > 0),
  );

  ngOnInit() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const artistId = params.get('id');
        if (artistId) {
          this.loadArtist(artistId);
        }
      });
  }

  private loadArtist(artistId: string) {
    if (this.artistCacheSvc.has(artistId)) {
      const cached = this.artistCacheSvc.get(artistId)!;
      this.artist.set(cached.artist);
      this.tracks.set(cached.tracks);
      this.albums.set(cached.albums);
      this.eps.set(cached.eps);
      this.singles.set(cached.singles);
      this.loading.set(false);
      this.loadingReleases.set(false);
      return;
    }

    this.loading.set(true);
    this.loadingReleases.set(true);

    const cacheEntry: {
      artist: any;
      tracks: Track[];
      albums: ReleaseItem[];
      eps: ReleaseItem[];
      singles: ReleaseItem[];
    } = { artist: null, tracks: [], albums: [], eps: [], singles: [] };

    this.searchSvc
      .getArtist(artistId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((artist) => {
        this.artist.set(artist);
        cacheEntry.artist = artist;
        const artistName = artist?.name ?? '';

        this.searchSvc
          .getArtistAlbums(artistId, artistName)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((albums) => {
            this.albums.set(albums);
            cacheEntry.albums = albums;
            this.artistCacheSvc.set(artistId, cacheEntry);
          });

        this.searchSvc
          .getArtistEPs(artistId, artistName)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((eps) => {
            this.eps.set(eps);
            cacheEntry.eps = eps;
            this.artistCacheSvc.set(artistId, cacheEntry);
          });

        this.searchSvc
          .getArtistSingles(artistId, artistName)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((singles) => {
            this.singles.set(singles);
            cacheEntry.singles = singles;
            this.loadingReleases.set(false);
            this.artistCacheSvc.set(artistId, cacheEntry);
          });
      });

    this.searchSvc
      .getArtistTracks(artistId, 5)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tracks) => {
        this.tracks.set(tracks);
        cacheEntry.tracks = tracks;
        this.loading.set(false);
        this.artistCacheSvc.set(artistId, cacheEntry);
      });
  }

  isInWishlist(id: string): boolean {
    return this.wishlistSvc.entries().some((e) => e.trackId === id);
  }

  isArtistInWishlist(artistId: string | number): boolean {
    return this.favoriteArtistsSvc.artistIds().has(String(artistId));
  }

  async toggle(track: Track) {
    const entries = this.wishlistSvc.entries();
    const existing = entries.find((e) => e.trackId === track.id);

    if (existing && existing.id) {
      await this.wishlistSvc.remove(existing.id);
    } else {
      const user = this.authSvc.currentUser();
      if (user) {
        await this.wishlistSvc.add(track, user);
      }
    }
  }

  async toggleArtist(e: Event) {
    e.stopPropagation();
    const currentArtist = this.artist();
    const user = this.authSvc.currentUser();
    if (!currentArtist || !user) return;

    const artistId = String(currentArtist.id);
    const existing = this.favoriteArtistsSvc
      .artists()
      .find((a) => a.artistId === artistId);

    if (existing && existing.id) {
      await this.favoriteArtistsSvc.remove(existing.id);
    } else {
      await this.favoriteArtistsSvc.add(
        artistId,
        currentArtist.name,
        currentArtist.picture_big,
        user,
      );
    }
  }

  onTrackPlayClicked(track: Track) {
    const playlist = this.tracks()
      .filter((t) => t.previewUrl)
      .map((t) => ({
        id: t.id,
        title: t.name,
        artist: t.artists?.[0] ?? '',
        cover: t.coverUrl,
        previewUrl: t.previewUrl!,
      }));

    const idx = playlist.findIndex((p) => p.id === track.id);
  }

  goBack() {
    this.location.back();
  }

  async toggleReleaseWishlist(e: Event, release: ReleaseItem) {
    e.stopPropagation();
    const entries = this.wishlistSvc.entries();
    const existing = entries.find((ent) => ent.trackId === release.id);

    if (existing && existing.id) {
      await this.wishlistSvc.remove(existing.id);
    } else {
      const user = this.authSvc.currentUser();
      if (user) {
        await this.wishlistSvc.addRelease(release, user);
      }
    }
  }

  navigateToAlbum(albumId: string) {
    this.router.navigate(['/', 'album', albumId]);
  }

  formatFans = formatFans;
}
