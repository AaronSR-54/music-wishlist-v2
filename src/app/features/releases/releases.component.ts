import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, forkJoin, of, from } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
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
import { apiUrl } from '../../core/api/api-url';
import {
  SegmentedTabsComponent,
  SegmentedTabOption,
} from '../../shared/components/segmented-tabs/segmented-tabs.component';
import { ScrollMaskDirective } from '../../shared/directives/scroll-mask.directive';

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
    SegmentedTabsComponent,
    ScrollMaskDirective,
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
      width: calc(100% + 32px);
      margin-inline: -16px;
      padding: 24px 16px 2rem;
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
      class="flex flex-col h-full p-0.5 pt-2 gap-4 w-full [animation:fadeIn_300ms_ease_both]"
    >
      <app-page-header prefix="01/" [title]="t().releases" [showBack]="false" [mobileOnly]="true" />

      <div
        class="flex flex-col h-full pb-8"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
      >
        <div class="w-full [animation:slideDown_300ms_ease_both]">
          <app-segmented-tabs
            variant="toggle"
            [activeWide]="true"
            [options]="monthOptions()"
            [value]="selectedMonthKey()"
            (valueChange)="selectMonth($event)"
          />
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
            appScrollMask
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
                  [compact]="true"
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
export class ReleasesComponent {
  private favoritesSvc = inject(FavoritesService);
  private wishlistSvc = inject(WishlistService);
  private authSvc = inject(AuthService);
  private languageService = inject(LanguageService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private apiUrl = '/api';

  contextMenu = signal<{ x: number; y: number; item: ReleaseItem } | null>(null);

  get isMobile(): boolean {
    return window.innerWidth < 1024;
  }

  t = computed(() => this.languageService.t());

  selectedYear = signal<number>(new Date().getFullYear());
  selectedMonth = signal<number>(new Date().getMonth());

  allReleases = signal<ReleaseItem[]>([]);
  loading = signal(false);
  animatingMonth = signal(false);

  private releasesCache = new Map<string, ReleaseItem[]>();
  private readonly CACHE_KEY = 'releasesCache';

  favorites = this.favoritesSvc.favorites;

  private touchStartX = 0;
  private readonly SWIPE_THRESHOLD = 50;

  selectedMonthKey = computed(
    () => `${this.selectedYear()}-${String(this.selectedMonth() + 1).padStart(2, '0')}`,
  );

  monthOptions = computed<SegmentedTabOption<string>[]>(() => {
    const selectedYear = this.selectedYear();
    const selectedMonth = this.selectedMonth();
    const language = this.t().jan === 'Enero' ? 'es' : 'en';
    const locale = language === 'es' ? 'es-ES' : 'en-US';
    const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'short' });
    const fullMonthFormatter = new Intl.DateTimeFormat(locale, { month: 'long' });
    const fullFormatter = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
    });
    const now = new Date();

    return [-1, 0, 1].map((offset) => {
      const date = new Date(selectedYear, selectedMonth + offset, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const isFuture =
        year > now.getFullYear() ||
        (year === now.getFullYear() && month > now.getMonth());
      const label = monthFormatter.format(date).replace(/\.$/, '').toLocaleUpperCase(locale);
      const fullMonth = fullMonthFormatter.format(date).toLocaleUpperCase(locale);

      return {
        value: key,
        label: offset === 0 ? fullMonth : label,
        suffix: offset === 0 || year !== selectedYear ? `'${String(year).slice(-2)}` : undefined,
        title: fullFormatter.format(date),
        disabled: isFuture,
      };
    });
  });

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

  private loadCacheFromSession() {
    try {
      const cached = sessionStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.releasesCache = new Map(Object.entries(parsed));
      }
    } catch {}
  }

  private saveCacheToSession() {
    try {
      const cacheObj = Object.fromEntries(this.releasesCache);
      sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObj));
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

  selectMonth(key: string) {
    const [year, month] = key.split('-').map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return;

    this.selectedYear.set(year);
    this.selectedMonth.set(month - 1);
  }

  isInWishlist(itemId: string): boolean {
    return this.wishlistSvc.entries().some((e) => e.trackId === itemId);
  }

  private loadReleases(
    year: number,
    month: number,
    favorites: { artistId: string; name: string }[],
  ) {
    if (favorites.length === 0) {
      this.allReleases.set([]);
      this.loading.set(false);
      return;
    }

    // Scope the cache to the current set of favorite artists so adding or
    // removing a favorite invalidates previously cached (possibly empty)
    // months.
    const favoritesKey = favorites
      .map((f) => f.artistId)
      .sort()
      .join(',');
    const cacheKey = `${year}-${month}|${favoritesKey}`;

    const cached = this.releasesCache.get(cacheKey);
    if (cached) {
      this.allReleases.set(cached);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    const artistObservables = favorites.map((fav) =>
      from(
        this.fetchJson(
          apiUrl(
            `${this.apiUrl}/artist-albums?id=${encodeURIComponent(fav.artistId)}&limit=100`,
          ),
        ),
      ).pipe(
        map(
          (
            res: DReleasesResponse,
          ): {
            fav: { artistId: string; name: string };
            releases: ReleaseItem[];
          } => ({
            fav,
            releases: (res.data ?? []).map((a: DeezerAlbum) => ({
              id: String(a.id),
              name: a.title,
              artist: fav.name ?? '',
              coverUrl: a.cover_big ?? a.cover_medium ?? '',
              type: (a.record_type === 'single'
                ? 'single'
                : 'album') as TrackType,
              releaseDate: a.release_date ?? '',
              previewUrl: undefined,
              artistId: a.artist?.id ? String(a.artist.id) : undefined,
            })),
          }),
        ),
        catchError(() => of({ fav, releases: [] as ReleaseItem[] })),
      ),
    );

    forkJoin(artistObservables)
      .pipe(
        map((results) => {
          const seen = new Set<string>();
          return results
            .flatMap((r) => r.releases)
            .filter((r) => {
              const key = `${r.id}:${r.type}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .filter((release) => {
              if (!release.releaseDate) return false;
              const [releaseYear, releaseMonth] = release.releaseDate
                .split('-')
                .slice(0, 2)
                .map(Number);
              return releaseYear === year && releaseMonth - 1 === month;
            });
        }),
        switchMap((filteredForMonth) => this.withPreviews(filteredForMonth)),
        map((releases) =>
          releases.sort(
            (a, b) =>
              new Date(b.releaseDate).getTime() -
              new Date(a.releaseDate).getTime(),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (sorted) => {
          this.releasesCache.set(cacheKey, sorted);
          this.allReleases.set(sorted);
          this.loading.set(false);
          this.saveCacheToSession();
        },
        error: () => this.loading.set(false),
      });
  }

  private withPreviews(releases: ReleaseItem[]): Observable<ReleaseItem[]> {
    const singles = releases.filter((r) => r.type === 'single');
    if (singles.length === 0) return of(releases);

    const previewCalls = singles.map((s) =>
      from(
        this.fetchJson(
          apiUrl(`${this.apiUrl}/album-tracks?id=${encodeURIComponent(s.id)}`),
        ),
      ).pipe(
        map((tracksRes: DAlbumTracksResponse) => ({
          id: s.id,
          previewUrl: tracksRes.data?.[0]?.preview
            ? apiUrl(`/api/preview?url=${encodeURIComponent(tracksRes.data[0].preview)}`)
            : undefined,
        })),
        catchError(() => of({ id: s.id, previewUrl: undefined })),
      ),
    );

    return forkJoin(previewCalls).pipe(
      map((previews) => {
        const previewMap = new Map(previews.map((p) => [p.id, p.previewUrl]));
        return releases.map((r) => ({
          ...r,
          previewUrl: previewMap.get(r.id),
        }));
      }),
    );
  }

  private async fetchJson(url: string): Promise<any> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
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
