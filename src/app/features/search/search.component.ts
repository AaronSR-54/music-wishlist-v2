import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewChild,
  AfterViewInit,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  combineLatest,
  of,
  tap,
  map,
} from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';

import { register } from 'swiper/element/bundle';

import { SearchService } from '../../core/api/search.service';
import { WishlistService } from '../../core/firebase/wishlist.service';
import { FavoriteArtistsService } from '../../core/firebase/favorite-artists.service';
import { ArtistMergeService } from '../../core/firebase/artist-merge.service';
import { ArtistImageService } from '../../core/firebase/artist-image.service';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { Track } from '../../shared/models/track.model';
import { formatFans } from '../../shared/utils/format-fans';
import { catalogExternalUrl } from '../../shared/utils/catalog-link';

import { SearchResultItemComponent } from '../../shared/components/search-result-item/search-result-item.component';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { ArtistCardComponent } from '../../shared/components/artist-card/artist-card.component';
import {
  TypeFilterComponent,
  FilterType,
  TypeFilterOption,
} from '../../shared/components/type-filter/type-filter.component';
import { SearchInputComponent } from '../../shared/components/search-input/search-input.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SearchEmptyStateComponent } from '../../shared/components/search-empty-state/search-empty-state.component';
import { CarouselComponent } from '../../shared/components/carousel/carousel.component';
import { ContextMenuPanelComponent } from '../../shared/components/context-menu-panel/context-menu-panel.component';
import { ToastService } from '../../shared/components/toast/toast.component';
import { ScrollMaskDirective } from '../../shared/directives/scroll-mask.directive';
import { CatalogSearchFilter } from '../../shared/models/catalog-provider';
import {
  matchQuality,
  rankCatalogResults,
} from '../../core/catalog/catalog-rank';

register();

function sameFilters(
  a: ReadonlySet<CatalogSearchFilter>,
  b: ReadonlySet<CatalogSearchFilter>,
): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

@Component({
  selector: 'app-search',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    SearchResultItemComponent,
    SpinnerComponent,
    ArtistCardComponent,
    TypeFilterComponent,
    SearchInputComponent,
    PageHeaderComponent,
    SearchEmptyStateComponent,
    CarouselComponent,
    ContextMenuPanelComponent,
    ScrollMaskDirective,
  ],
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .scroll-fade {
      flex: 1;
      overflow-y: auto;
      scrollbar-width: none;
      padding: 4px 8px 2rem;
    }
    .scroll-fade::-webkit-scrollbar {
      display: none;
    }
    .artist-anim {
      animation: fadeInRight 0.5s ease-out both;
    }
    @keyframes fadeInRight {
      from {
        opacity: 0;
        transform: translateX(15px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    .search-input {
      animation: slideDown 300ms cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .type-filter {
      animation: slideDown 350ms cubic-bezier(0.4, 0, 0.2, 1) both;
      animation-delay: 50ms;
    }
    .results-enter {
      animation: fadeInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .favorites-section {
      animation: fadeIn 400ms cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(15px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
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
        [showArtist]="false"
        [showAlbum]="false"
        [showRemove]="false"
      />
    }

    <div
      class="flex flex-col justify-between h-full overflow-hidden p-0.5 pt-2"
    >
      <section class="flex flex-col flex-1 min-h-0">
        <div class="flex flex-col gap-4">
          <app-page-header
            prefix="02/"
            [title]="t().search"
            [mobileOnly]="true"
            [showBack]="false"
          />

          <app-search-input
            class="search-input block h-12 shrink-0"
            [query]="query()"
            [placeholder]="t().searchPlaceholder"
            [clearLabel]="t().clear"
            (queryChange)="onQuery($event)"
            (clear)="clearQuery()"
            (focusChange)="inputFocused.set($event)"
          />
        </div>

        @if (query() && typeFilterOptions().length > 1) {
          <app-type-filter
            class="type-filter w-full"
            [options]="typeFilterOptions()"
            [selectedTypes]="selectedTypes()"
            (toggle)="toggleType($event)"
          />
        }

        @switch (state()) {
          @case ('loading') {
            <div
              class="scroll-fade flex items-center justify-center min-h-[300px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              appScrollMask
            >
              <div
                class="flex flex-col items-center gap-4 text-ink-600 dark:text-bone-600"
              >
                <app-spinner size="md" />
                <span class="italic text-sm">{{ t().searching }}</span>
              </div>
            </div>
          }
          @case ('results') {
            <div
              class="scroll-fade results-enter"
              appScrollMask
            >
              @for (item of filteredResults(); track item.id; let i = $index) {
                <div
                  class="select-none"
                  (contextmenu)="onContextMenu($event, item)"
                >
                  <app-search-result-item
                    [style.animation]="'searchReveal 400ms cubic-bezier(0.16,1,0.3,1) both'"
                    [style.animation-delay]="i * 30 + 'ms'"
                    [item]="item"
                    [type]="item.type"
                    [isAdded]="isAdded(item.id, item.type)"
                    [showAddButton]="true"
                    [showTypeChip]="showTypeChip()"
                    (onArtistClick)="goToArtist($event)"
                    (onAlbumClick)="goToAlbum($event)"
                    (onAddClick)="toggleAction($event)"
                    (onMoreClick)="onMoreClick($event)"
                  />
                </div>
              }
            </div>
          }
          @case ('empty') {
            <app-search-empty-state
              variant="empty"
              [title]="t().noResults"
              [subtitle]="t().tryAnotherSearch"
            />
          }
          @case ('error') {
            <app-search-empty-state
              variant="empty"
              [title]="t().searchError"
              [subtitle]="t().tryAnotherSearch"
            />
          }
          @default {
            <app-search-empty-state
              variant="idle"
              [title]="t().startSearching"
              [subtitle]="t().searchSubtitle"
            />
          }
        }
      </section>

      @if (!query() && !inputFocused() && favoriteArtists().length > 0) {
        <div
          class="py-3 pb-6 md:pb-0 border-t border-bone-100 dark:border-ink-100 favorites-section transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
        >
          <h3
            class="font-display text-sm font-bold text-ink-700 dark:text-bone-700 mb-3 uppercase tracking-[0.14em] px-2"
          >
            {{ t().favoriteArtists }}
          </h3>
          <app-carousel
            [preferredItemWidth]="carouselPreferredWidth()"
            [itemSpacing]="8"
            [leadingPadding]="8"
            [trailingPadding]="0"
            [minSmallItemWidth]="40"
            [maxSmallItemWidth]="56"
          >
            @for (artist of favoriteArtists(); track artist.id) {
              <div class="carousel-item">
                <app-artist-card
                  class="artist-anim"
                  [artist]="artist"
                  (click)="goToArtist(artist)"
                  (onRemoveFavorite)="removeFavorite($event)"
                />
              </div>
            }
          </app-carousel>
        </div>
      }
    </div>
  `,
})
export class SearchComponent implements AfterViewInit {
  private searchSvc = inject(SearchService);
  private wishlistSvc = inject(WishlistService);
  private favoriteArtistsSvc = inject(FavoriteArtistsService);
  private artistMergeSvc = inject(ArtistMergeService);
  private artistImageSvc = inject(ArtistImageService);
  private authSvc = inject(AuthService);
  private languageService = inject(LanguageService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private breakpointObserver = inject(BreakpointObserver);

  @ViewChild(SearchInputComponent) private searchInput?: SearchInputComponent;

  focusOnInit = input(false);
  focusHandled = output<void>();

  contextMenu = signal<{ x: number; y: number; item: Track } | null>(null);
  inputFocused = signal(false);

  constructor() {
    this.searchSvc.loadProviders().subscribe();

    // Silent filters are worse than no filters: when the provider set cannot
    // return a type (e.g. YouTube is not configured), drop it from the current
    // selection. Wait for the availability check so a saved videos filter is
    // not pruned before the server answers.
    effect(() => {
      if (!this.searchSvc.providersReady()) return;

      const supported = new Set<string>(
        this.typeFilterOptions().map((option) => option.value),
      );
      const current = this.selectedTypes();
      if (current.size === 0) return;

      const pruned = new Set(
        [...current].filter((type) => supported.has(type)),
      );
      if (pruned.size === current.size) return;

      this.selectedTypes.set(pruned);
      this.searchSvc.saveSearchState(this.query(), pruned, this.results());
    });
  }

  get isMobile(): boolean {
    return window.innerWidth < 1024;
  }

  t = computed(() => this.languageService.t());
  query = signal(this.searchSvc.getSavedSearchState()?.query || '');
  selectedTypes = signal<Set<CatalogSearchFilter>>(
    this.searchSvc.getSavedSearchState()?.selectedTypes || new Set(),
  );
  loading = signal(false);
  searchError = signal(false);

  videosAvailable = this.searchSvc.videosAvailable;

  favoriteArtists = computed(() => {
    const seen = new Set<string>();
    return this.favoriteArtistsSvc.artists().filter((artist) => {
      const root = this.artistMergeSvc.resolveId(artist.artistId);
      if (seen.has(root)) return false;
      seen.add(root);
      return true;
    });
  });

  /**
   * The multi-browse carousel scales its large item to the container width, which makes the
   * favorite artists covers enormous on desktop. Capping the preferred width keeps them as a
   * compact strip (around 150px) while mobile continues to use the viewport-relative size.
   */
  private isDesktop = toSignal(
    this.breakpointObserver
      .observe('(min-width: 1024px)')
      .pipe(map((r) => r.matches)),
    { initialValue: window.matchMedia('(min-width: 1024px)').matches },
  );

  carouselPreferredWidth = computed(() => (this.isDesktop() ? 150 : 0));

  ngAfterViewInit(): void {
    if (this.focusOnInit()) {
      this.searchInput?.focus();
      this.focusHandled.emit();
    }
  }

  private results$ = combineLatest([
    toObservable(this.query),
    toObservable(this.selectedTypes),
  ]).pipe(
    debounceTime(300),
    distinctUntilChanged(
      ([previousQuery, previousTypes], [query, types]) =>
        previousQuery === query && sameFilters(previousTypes, types),
    ),
    tap(([q]) => {
      if (q.trim()) this.loading.set(true);
    }),
    switchMap(([q, types]) => {
      const trimmed = q.trim();
      if (!trimmed) return of([]);
      return this.searchSvc.search(trimmed, types).pipe(
        map((items) => this.withSavedArtists(items, trimmed, types)),
        tap(() => this.searchError.set(false)),
        catchError(() => {
          this.searchError.set(true);
          return of([]);
        }),
        tap(() => this.loading.set(false)),
      );
    }),
    tap((res) => {
      this.searchSvc.saveSearchState(this.query(), this.selectedTypes(), res);
      this.loading.set(false);
    }),
  );

  results = toSignal(this.results$, {
    initialValue: this.searchSvc.getSavedSearchState()?.results || [],
  });

  filteredResults = computed(() => {
    const res = this.results();
    const types = this.selectedTypes();
    const seenArtists = new Set<string>();
    let artistCount = 0;

    // Artists merged by the user are one artist: keep only the first record of
    // the group. Without a filter, also keep the list useful by capping them.
    const filtered = res.filter((item) => {
      if (item.type !== 'artist') return true;

      const root = this.artistMergeSvc.resolveId(item.id);
      if (seenArtists.has(root)) return false;
      seenArtists.add(root);

      if (types.size > 0) return true;
      return ++artistCount <= 5;
    });

    // Artist rows show the photo the user picked, when there is one.
    return filtered.map((item) =>
      item.type === 'artist'
        ? {
            ...item,
            coverUrl: this.artistImageSvc.resolve(item.id, item.coverUrl),
          }
        : item,
    );
  });

  showTypeChip = computed(
    () => this.typeFilterOptions().length > 1 && this.selectedTypes().size !== 1,
  );

  state = computed(() => {
    if (this.loading()) return 'loading';
    if (!this.query().trim()) return 'idle';
    if (this.searchError()) return 'error';
    return this.filteredResults().length > 0 ? 'results' : 'empty';
  });

  typeFilterOptions = computed<TypeFilterOption<FilterType>[]>(() => {
    const supported = new Set<string>(
      this.searchSvc.capabilities().searchTypes,
    );
    const options: TypeFilterOption<FilterType>[] = [
      { value: 'artist', label: this.t().artists },
      { value: 'track', label: this.t().songs },
      { value: 'album', label: this.t().albums },
      { value: 'ep', label: this.t().eps },
    ];
    const catalogOptions = options.filter((option) =>
      supported.has(option.value),
    );

    // Videos are one more filter, not a separate mode: selecting it runs a
    // single YouTube search instead of the catalog calls.
    if (this.videosAvailable()) {
      catalogOptions.push({ value: 'video', label: this.t().videos });
    }
    return catalogOptions;
  });

  onQuery(val: string) {
    this.query.set(val);
  }

  clearQuery() {
    this.query.set('');
    this.selectedTypes.set(new Set());
  }

  toggleType(type: string) {
    const typeVal = type as CatalogSearchFilter;
    const updated = new Set<CatalogSearchFilter>(this.selectedTypes());
    updated.has(typeVal)
      ? updated.delete(typeVal)
      : (updated.clear(), updated.add(typeVal));
    this.selectedTypes.set(updated);
  }

  /**
   * A provider's search index does not always return an artist for its own
   * name (Deezer never returns `deezer:105607162` for "iban"), so a saved
   * artist that matches the query is injected: if the user follows it, it must
   * be findable. Saved artists also get a small ranking boost.
   */
  private withSavedArtists(
    items: Track[],
    query: string,
    filters: ReadonlySet<CatalogSearchFilter>,
  ): Track[] {
    if (filters.size > 0 && !filters.has('artist')) return items;

    const known = new Set<string>();
    for (const item of items) {
      if (item.type === 'artist') {
        known.add(this.artistMergeSvc.resolveId(item.id));
      }
    }

    const saved: Track[] = [];
    for (const artist of this.favoriteArtistsSvc.artists()) {
      const root = this.artistMergeSvc.resolveId(artist.artistId);
      if (known.has(root)) continue;
      if (matchQuality(artist.name, query) === 0) continue;

      known.add(root);
      saved.push({
        id: artist.artistId,
        artistId: artist.artistId,
        provider: artist.provider,
        name: artist.name,
        artists: [artist.name],
        coverUrl: this.artistImageSvc.resolve(artist.artistId, artist.image ?? ''),
        type: 'artist',
        uri: '',
      });
    }

    return rankCatalogResults(
      [...items, ...saved],
      query,
      this.favoriteArtistsSvc.artistIds(),
    );
  }

  isAdded(id: string, type?: string): boolean {
    if (type !== 'artist') return this.wishlistSvc.trackIds().has(id);

    return this.artistMergeSvc
      .groupIds(id)
      .some((artistId) => this.favoriteArtistsSvc.artistIds().has(artistId));
  }

  async toggleAction(track: Track) {
    const user = this.authSvc.currentUser();
    if (!user) return;

    if (track.type === 'artist') {
      const group = this.artistMergeSvc.groupIds(track.id);
      const existing = this.favoriteArtistsSvc
        .artists()
        .filter((a) => group.includes(a.artistId));

      if (existing.length > 0) {
        for (const artist of existing) {
          if (artist.id) await this.favoriteArtistsSvc.remove(artist.id);
        }
      } else {
        const cover = track.coverUrl || (await this.fetchArtistImage(track.id));
        await this.favoriteArtistsSvc.add(track.id, track.name, cover, user);
      }
    } else {
      const existing = this.wishlistSvc
        .entries()
        .find((e) => e.trackId === track.id);
      existing?.id
        ? await this.wishlistSvc.remove(existing.id)
        : await this.wishlistSvc.add(track, user);
    }
  }

  private async fetchArtistImage(id: string): Promise<string> {
    try {
      const data = await this.searchSvc.getArtist(id).toPromise();
      return data?.coverUrl || '';
    } catch {
      return '';
    }
  }

  removeFavorite(artistId: string) {
    const item = this.favoriteArtistsSvc
      .artists()
      .find((a) => a.artistId === artistId);
    if (item?.id) this.favoriteArtistsSvc.remove(item.id);
  }

  goToArtist(artist: any) {
    this.router.navigate(['/artist', artist.artistId || artist.id]);
  }

  goToAlbum(albumId: string) {
    this.router.navigate(['/album', albumId]);
  }

  onContextMenu(event: MouseEvent, item: Track): void {
    if (item.type === 'artist') return;
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, item });
  }

  onMoreClick(event: { item: any; x: number; y: number }): void {
    const track = event.item as Track;
    if (track.type === 'artist') return;
    this.contextMenu.set({ x: event.x, y: event.y, item: track });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  async copyFromContextMenu(): Promise<void> {
    const menu = this.contextMenu();
    if (!menu) return;
    const url = catalogExternalUrl(menu.item);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success(
        this.languageService.t().toastLinkCopied,
        this.languageService.t().toastLinkCopiedPlural,
      );
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
    if (menu?.item.albumId) {
      this.router.navigate(['/album', menu.item.albumId]);
    }
    this.closeContextMenu();
  }
}
