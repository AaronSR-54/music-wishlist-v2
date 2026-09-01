import {
  Component,
  computed,
  effect,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of, from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SearchService } from '../../core/api/search.service';
import { FavoritesService } from '../../core/firebase/favorites.service';
import { WishlistService } from '../../core/firebase/wishlist.service';
import { AuthService } from '../../core/auth/auth.service';
import { ReleaseItem } from '../../shared/models/release-item.model';
import { TrackType } from '../../shared/models/track.model';
import { DeezerAlbum, DReleasesResponse, DAlbumTracksResponse } from '../../shared/models/deezer';
import { CardItemComponent } from '../../shared/components/card-item/card-item.component';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LanguageService } from '../../core/i18n/language.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ContextMenuPanelComponent } from '../../shared/components/context-menu-panel/context-menu-panel.component';
import { ToastService } from '../../shared/components/toast/toast.component';

@Component({
  selector: 'app-releases',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CardItemComponent,
    SpinnerComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    ContextMenuPanelComponent,
  ],
  styles: `
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    .releases-grid {
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: max-content;
      gap: 8px;
      overflow: auto;
      scrollbar-width: none;
      height: 100%;
      padding-top: 16px;
      padding-bottom: 2rem;
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
    .releases-grid::-webkit-scrollbar {
      display: none;
    }
    @media (min-width: 1100px) and (max-width: 1623px) {
      .releases-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (min-width: 1624px) and (max-width: 1899px) {
      .releases-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
    @media (min-width: 1900px) {
      .releases-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
    }
  `,
  template: `
    @if (contextMenu()) {
      <app-context-menu-panel
        [x]="contextMenu()!.x"
        [y]="contextMenu()!.y"
        [mobile]="isMobile"
        (onClose)="closeContextMenu()"
        (onCopyLink)="copyFromContextMenu()"
        (onGoToArtist)="goToArtistFromContextMenu()"
        (onGoToAlbum)="goToAlbumFromContextMenu()"
        [showArtist]="!!contextMenu()!.item.artistId"
        [showAlbum]="true"
        [showRemove]="false"
      />
    }

    <div
      class="flex flex-col h-full overflow-hidden p-0.5 pt-2 gap-4 w-full [animation:fadeIn_300ms_ease_both]"
    >
      <app-page-header prefix="01/" title="LANZAMIENTOS" [showBack]="false" [mobileOnly]="true" />

      <div
        class="flex flex-col h-full pb-8"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
      >
        <div
          class="flex items-center justify-center border-b-[1.5px] border-bone-100 dark:border-ink-100 [animation:slideDown_300ms_ease_both]"
        >
          <div
            class="flex items-center justify-between gap-8 py-1 w-full md:w-80 md:mx-auto"
          >
            <button
              class="w-8 h-8 border-none bg-transparent text-ink dark:text-bone cursor-pointer text-lg md:text-[1.375rem] font-semibold transition-[color,transform] duration-fast ease-smooth p-0 flex items-center justify-center hover:text-ink-100 dark:hover:text-bone-100 hover:scale-[1.15] active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed disabled:pointer-events-none"
              (click)="prevMonth()"
              [title]="t().prevMonth"
            >
              &lt;
            </button>
            <span
              class="font-display flex items-baseline justify-center gap-[2px] leading-none text-ink dark:text-bone min-w-[150px] text-center uppercase py-4 transition-opacity duration-[200ms] ease-[ease]"
            >
              <span class="font-semibold tracking-[0.04em] text-3xl">{{
                monthLabel()
              }}</span>
              <span
                class=" text-ink-700 dark:text-bone-700 text-3xl font-light italic"
                >{{ yearLabel() }}</span
              >
            </span>
            <button
              class="w-8 h-8 border-none bg-transparent text-ink dark:text-bone cursor-pointer text-lg md:text-[1.375rem] font-semibold transition-[color,transform] duration-fast ease-smooth p-0 flex items-center justify-center hover:text-ink-100 dark:hover:text-bone-100 hover:scale-[1.15] active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed disabled:pointer-events-none"
              [disabled]="!canGoToNextMonth()"
              (click)="nextMonth()"
              [title]="t().nextMonth"
            >
              &gt;
            </button>
          </div>
        </div>

        @if (loading()) {
          <div
            class="flex flex-col items-center justify-center gap-4 min-h-[300px] py-10 px-5 text-ink-600 dark:text-bone-600 text-center [animation:fadeIn_300ms_ease_both]"
          >
            <app-spinner size="md" />
            <span
              class="text-sm md:text-lg italic"
              >{{ t().loadingReleases }}</span
            >
          </div>
        } @else if (allReleases().length === 0) {
          <app-empty-state
            [icon]="favorites().length === 0 ? 'heart' : 'music-note'"
            [title]="
              favorites().length === 0 ? t().noFavoriteArtists : t().noReleasesThisMonth
            "
            [subtitle]="
              favorites().length === 0
                ? t().searchFavoriteArtists
                : t().noReleasesFromFavorites
            "
          />
        } @else {
          <div
            class="releases-grid transition-opacity duration-300"
            [class.opacity-0]="animatingMonth()"
          >
            @for (
              item of allReleases();
              track item.id + ':' + item.type;
              let i = $index
            ) {
              <div
                class="select-none"
                (contextmenu)="onContextMenu($event, item)"
              >
                <app-card-item
                  class="[animation:scaleIn_300ms_ease_both]"
                  [style.animation-delay]="i * 30 + 'ms'"
                  [item]="item"
                  [isAdded]="isInWishlist(item.id)"
                  (toggleWishlist)="toggleWishlist($event)"
                  (onAlbumClick)="goToAlbum($event)"
                  (onMoreClick)="onMoreClick($event)"
                />
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ReleasesComponent implements OnInit {
  private searchSvc = inject(SearchService);
  private favoritesSvc = inject(FavoritesService);
  private wishlistSvc = inject(WishlistService);
  private authSvc = inject(AuthService);
  private languageService = inject(LanguageService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private apiUrl = 'https://music-wishlist-v2.vercel.app/api';

  contextMenu = signal<{ x: number; y: number; item: ReleaseItem } | null>(null);

  get isMobile(): boolean {
    return window.innerWidth < 768;
  }

  t = computed(() => this.languageService.t());

  selectedYear = signal<number>(new Date().getFullYear());
  selectedMonth = signal<number>(new Date().getMonth());

  allReleases = signal<ReleaseItem[]>([]);
  loading = signal(false);
  animatingMonth = signal(false);

  private releasesCache = new Map<string, ReleaseItem[]>();
  private currentCacheKey = '';
  private readonly CACHE_KEY = 'releasesCache';
  private readonly NO_RELEASES_KEY = 'noReleasesArtists';

  favorites = this.favoritesSvc.favorites;

  private touchStartX = 0;
  private readonly SWIPE_THRESHOLD = 50;
  private noReleasesArtists = new Set<string>();

  monthNames = computed(() => [
    this.t().jan, this.t().feb, this.t().mar, this.t().apr, this.t().may, this.t().jun,
    this.t().jul, this.t().aug, this.t().sep, this.t().oct, this.t().nov, this.t().dec,
  ]);

  monthLabel = computed(() => this.monthNames()[this.selectedMonth()]);
  yearLabel = computed(() => this.selectedYear().toString());

  canGoToNextMonth = computed(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const selectedYear = this.selectedYear();
    const selectedMonth = this.selectedMonth();
    return !(selectedYear === currentYear && selectedMonth === currentMonth);
  });

  constructor() {
    this.loadCacheFromSession();
    effect(() => {
      const year = this.selectedYear();
      const month = this.selectedMonth();
      const favorites = this.favorites();
      this.loadReleases(year, month, favorites);
    });
  }

  ngOnInit() {}

  private loadCacheFromSession() {
    try {
      const cached = sessionStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.releasesCache = new Map(Object.entries(parsed));
      }

      const noReleases = sessionStorage.getItem(this.NO_RELEASES_KEY);
      if (noReleases) {
        const arr: string[] = JSON.parse(noReleases);
        this.noReleasesArtists = new Set(arr);
      }
    } catch {}
  }

  private saveCacheToSession() {
    try {
      const cacheObj = Object.fromEntries(this.releasesCache);
      sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObj));
      sessionStorage.setItem(this.NO_RELEASES_KEY, JSON.stringify([...this.noReleasesArtists]));
    } catch {}
  }

  prevMonth() {
    let month = this.selectedMonth() - 1;
    let year = this.selectedYear();

    if (month < 0) {
      month = 11;
      year--;
    }

    this.selectedMonth.set(month);
    this.selectedYear.set(year);
  }

  nextMonth() {
    if (!this.canGoToNextMonth()) return;

    let month = this.selectedMonth() + 1;
    let year = this.selectedYear();

    if (month > 11) {
      month = 0;
      year++;
    }

    const now = new Date();
    if (
      year > now.getFullYear() ||
      (year === now.getFullYear() && month > now.getMonth())
    ) {
      return;
    }

    this.selectedMonth.set(month);
    this.selectedYear.set(year);
  }

  isInWishlist(itemId: string): boolean {
    return this.wishlistSvc.entries().some((e) => e.trackId === itemId);
  }

  private loadReleases(year: number, month: number, favorites: { artistId: string; name: string }[]) {
    const cacheKey = `${year}-${month}`;

    if (favorites.length === 0) {
      this.allReleases.set([]);
      this.currentCacheKey = '';
      return;
    }

    if (this.releasesCache.has(cacheKey)) {
      this.allReleases.set(this.releasesCache.get(cacheKey)!);
      this.currentCacheKey = cacheKey;
      return;
    }

    if (this.currentCacheKey && this.releasesCache.has(this.currentCacheKey)) {
      this.allReleases.set(this.releasesCache.get(this.currentCacheKey)!);
    }

    const noReleaseKey = `${year}-${month}`;

    if (this.noReleasesArtists.has(noReleaseKey)) {
      this.allReleases.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    const artistObservables = favorites.map((fav) =>
      from(
        fetch(`${this.apiUrl}/artist-albums?id=${fav.artistId}`).then((r) =>
          r.json(),
        ),
      ).pipe(
        map((res: DReleasesResponse): { fav: { artistId: string; name: string }; releases: ReleaseItem[] } => ({
          fav,
          releases: (res.data ?? []).map((a: DeezerAlbum) => ({
            id: String(a.id),
            name: a.title,
            artist: fav.name ?? '',
            coverUrl: a.cover_big ?? a.cover_medium ?? '',
            type: (a.record_type === 'single' ? 'single' : 'album') as TrackType,
            releaseDate: a.release_date ?? '',
            previewUrl: undefined,
            artistId: a.artist?.id ? String(a.artist.id) : undefined,
          })),
        })),
        catchError(() =>
          of({
            fav,
            releases: [] as ReleaseItem[],
          }),
        ),
      ),
    );

    forkJoin(artistObservables).subscribe((results) => {
      const allReleases = results.flatMap((r) => r.releases);

      const seen = new Set<string>();
      const deduplicated = allReleases.filter((r) => {
        const key = `${r.id}:${r.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const filteredForMonth = deduplicated.filter((release) => {
        if (!release.releaseDate) return false;
        const [releaseYear, releaseMonth] = release.releaseDate
          .split('-')
          .slice(0, 2)
          .map(Number);
        return releaseYear === year && releaseMonth - 1 === month;
      });

      if (filteredForMonth.length === 0) {
        this.noReleasesArtists.add(noReleaseKey);
        this.allReleases.set([]);
        this.releasesCache.set(cacheKey, []);
        this.currentCacheKey = cacheKey;
        this.loading.set(false);
        this.saveCacheToSession();
        return;
      }

      const singles = filteredForMonth.filter((r) => r.type === 'single');
      const albums = filteredForMonth.filter((r) => r.type !== 'single');

      if (singles.length === 0) {
        const sorted = filteredForMonth.sort((a, b) => {
          const dateA = new Date(a.releaseDate).getTime();
          const dateB = new Date(b.releaseDate).getTime();
          return dateB - dateA;
        });

        this.releasesCache.set(cacheKey, sorted);
        this.currentCacheKey = cacheKey;
        this.allReleases.set(sorted);
        this.loading.set(false);
        this.saveCacheToSession();
        return;
      }

      const previewCalls = singles.map((s) =>
        from(
          fetch(`${this.apiUrl}/album-tracks?id=${s.id}`).then((r) =>
            r.json(),
          ),
        ).pipe(
          map((tracksRes: DAlbumTracksResponse) => ({
            id: s.id,
            previewUrl: tracksRes.data?.[0]?.preview
              ? `/api/preview?url=${encodeURIComponent(tracksRes.data[0].preview)}`
              : undefined,
          })),
          catchError(() => of({ id: s.id, previewUrl: undefined })),
        ),
      );

      forkJoin(previewCalls).subscribe((previews) => {
        const previewMap = new Map(previews.map((p) => [p.id, p.previewUrl]));

        const withPreviews = filteredForMonth.map((r) => ({
          ...r,
          previewUrl: previewMap.get(r.id),
        }));

        const sorted = withPreviews.sort((a, b) => {
          const dateA = new Date(a.releaseDate).getTime();
          const dateB = new Date(b.releaseDate).getTime();
          return dateB - dateA;
        });

        this.releasesCache.set(cacheKey, sorted);
        this.currentCacheKey = cacheKey;
        this.allReleases.set(sorted);
        this.loading.set(false);
        this.saveCacheToSession();
      });
    });
  }

  openInYouTube(item: ReleaseItem) {
    const query = `${item.artist} ${item.name}`;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  }

  async toggleWishlist(item: ReleaseItem) {
    const entry = this.wishlistSvc.entries().find((e) => e.trackId === item.id);

    if (entry && entry.id) {
      await this.wishlistSvc.remove(entry.id);
    } else {
      const user = this.authSvc.currentUser();
      if (!user) return;
      await this.wishlistSvc.addRelease(item, user);
    }
  }

  onTouchStart(e: TouchEvent) {
    if (e.touches.length > 0) {
      this.touchStartX = e.touches[0].clientX;
    }
  }

  onTouchEnd(e: TouchEvent) {
    if (e.changedTouches.length === 0) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = this.touchStartX - touchEndX;

    if (Math.abs(diff) < this.SWIPE_THRESHOLD) return;

    this.animatingMonth.set(true);
    setTimeout(() => {
      if (diff > 0) {
        this.nextMonth();
      } else {
        this.prevMonth();
      }
      this.animatingMonth.set(false);
    }, 150);
  }

  goToAlbum(albumId: string) {
    this.router.navigate(['/album', albumId]);
  }

  onContextMenu(event: MouseEvent, item: ReleaseItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, item });
  }

  onMoreClick(event: { item: ReleaseItem; x: number; y: number }): void {
    this.contextMenu.set({ x: event.x, y: event.y, item: event.item });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  async copyFromContextMenu(): Promise<void> {
    const menu = this.contextMenu();
    if (!menu) return;
    const url = `https://deezer.com/album/${menu.item.id}`;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success(this.languageService.t().toastLinkCopied);
    } catch {
      this.toast.error(this.languageService.t().toastError);
    }
    this.closeContextMenu();
  }

  goToArtistFromContextMenu(): void {
    const menu = this.contextMenu();
    if (menu?.item.artistId) {
      this.router.navigate(['/artist', menu.item.artistId]);
    }
    this.closeContextMenu();
  }

  goToAlbumFromContextMenu(): void {
    const menu = this.contextMenu();
    if (menu) {
      this.router.navigate(['/album', menu.item.id]);
    }
    this.closeContextMenu();
  }
}
