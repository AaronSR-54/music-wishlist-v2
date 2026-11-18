import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  DestroyRef,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SearchService } from '../../core/api/search.service';
import { WishlistService } from '../../core/firebase/wishlist.service';
import { FavoriteArtistsService } from '../../core/firebase/favorite-artists.service';
import { ArtistMergeService } from '../../core/firebase/artist-merge.service';
import { ArtistImageService } from '../../core/firebase/artist-image.service';
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
import { ContextMenuPanelComponent } from '../../shared/components/context-menu-panel/context-menu-panel.component';
import { ToastService } from '../../shared/components/toast/toast.component';
import { SuperuserService } from '../../core/superuser/superuser.service';
import { ScrollMaskDirective } from '../../shared/directives/scroll-mask.directive';
import { catalogExportLine, catalogExternalUrl } from '../../shared/utils/catalog-link';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { ArtistMergePickerComponent } from '../../shared/components/artist-merge-picker/artist-merge-picker.component';
import { ArtistPhotoEditorComponent } from '../../shared/components/artist-photo-editor/artist-photo-editor.component';

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
    ContextMenuPanelComponent,
    ScrollMaskDirective,
    ModalComponent,
    ArtistMergePickerComponent,
    ArtistPhotoEditorComponent,
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
    @if (contextMenu()) {
      <app-context-menu-panel
        [x]="contextMenu()!.x"
        [y]="contextMenu()!.y"
        [mobile]="isMobile"
        (onClose)="closeContextMenu()"
        (onCopyLink)="copyFromContextMenu()"
        [showArtist]="false"
        [showAlbum]="contextMenu()!.kind === 'release'"
        (onGoToAlbum)="goToAlbumFromContextMenu()"
        [showRemove]="false"
      />
    }

    <div class="flex flex-col h-full overflow-hidden p-0.5 pt-2 gap-4">
      <app-page-header
        prefix="02.a/"
        [title]="t().artist"
        [backLabel]="t().back"
        (back)="goBack()"
      />

      <div class="scroll-fade flex flex-col p-2 gap-8 lg:gap-16" appScrollMask>
        @if (notFound()) {
          <div class="flex flex-col items-center gap-3 py-16 text-ink-500 dark:text-bone-500">
            <p class="font-display text-lg">{{ t().noResults }}</p>
          </div>
        }
        <div class="flex items-center gap-4 lg:gap-8 mt-4">
          <div class="relative shrink-0 artist-cover">
            <div
              class="w-[112px] h-[112px] lg:w-[168px] lg:h-[168px] rounded-full overflow-hidden shadow-ink/5 shadow-lg"
            >
              @if (artist(); as a) {
                <app-cover [name]="a.name" [coverUrl]="artistCoverUrl()" />
              }
            </div>

            @if (artist()) {
              <button
                type="button"
                class="absolute bottom-0 right-0 z-10 flex items-center justify-center w-9 h-9 lg:w-11 lg:h-11 rounded-full border-none bg-ink text-bone dark:bg-bone dark:text-ink shadow-lg cursor-pointer transition-transform duration-base ease-smooth hover:scale-[1.06] active:scale-[0.9]"
                (click)="openPhotoModal()"
                [title]="t().changePhoto"
                [attr.aria-label]="t().changePhoto"
              >
                <app-icon name="edit" class="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            }
          </div>

          <div class="flex-1 min-w-0 flex flex-col gap-2 lg:gap-3">
            @if (artist(); as a) {
              <div class="flex items-center gap-3 lg:gap-4 artist-name">
                <h1
                  class="m-0 min-w-0 flex-1 truncate text-[1.75rem] lg:text-[3rem] font-bold font-display leading-[1.15] text-ink dark:text-bone"
                >
                  {{ a.name }}
                </h1>
                <button
                  class="[&.active]:btn-pop-in w-9 h-9 lg:w-12 lg:h-12 rounded-full cursor-pointer flex items-center justify-center text-ink-600 dark:text-bone-600 shrink-0 bg-transparent p-0 transition-[color,transform] duration-fast ease-smooth hover:scale-[1.05] active:scale-[0.88]"
                  [class.active]="isArtistInWishlist(a.id)"
                  (click)="toggleArtist($event)"
                  [title]="
                    isArtistInWishlist(a.id)
                      ? t().removeFromWishlist
                      : t().addToWishlist
                  "
                >
                  @if (isArtistInWishlist(a.id)) {
                    <app-icon name="heart-filled" class="w-8 h-8 lg:w-12 lg:h-12" />
                  } @else {
                    <app-icon name="heart" class="w-8 h-8 lg:w-12 lg:h-12" />
                  }
                </button>
                <button
                  class="w-9 h-9 lg:w-12 lg:h-12 rounded-full cursor-pointer flex items-center justify-center text-ink-600 dark:text-bone-600 shrink-0 bg-transparent p-0 transition-[color,transform] duration-fast ease-smooth hover:scale-[1.05] active:scale-[0.88]"
                  (click)="openMergeModal()"
                  [title]="t().mergeArtists"
                  [attr.aria-label]="t().mergeArtists"
                >
                  <app-icon name="link" class="w-6 h-6 lg:w-8 lg:h-8" />
                </button>
              </div>

              <div
                class="flex flex-col items-start gap-0 text-ink dark:text-bone artist-meta leading-none"
              >
                @if (a.fanCount !== undefined) {
                  <span class="flex items-baseline gap-[2px]">
                    <span class="text-xs lg:text-sm font-bold">{{
                      formatFans(a.fanCount)
                    }}</span>
                    <span
                      class="font-display italic text-[0.6875rem] lg:text-sm text-ink-700 dark:text-bone-700 uppercase tracking-[0.5px]"
                      >{{ t().followers }}</span
                    >
                  </span>
                }
                @if (albumTotal() !== undefined) {
                  <span class="flex items-baseline gap-[2px]">
                    <span class="text-xs lg:text-sm font-bold">{{
                      albumTotal()
                    }}</span>
                    <span
                      class="font-display italic text-[0.6875rem] lg:text-sm text-ink-700 dark:text-bone-700 uppercase tracking-[0.5px]"
                      >{{ t().albums2 }}</span
                    >
                  </span>
                }
              </div>

              @if (mergedAliasNames().length > 0) {
                <div
                  class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] lg:text-xs text-ink-600 dark:text-bone-600"
                >
                  <span
                    class="font-semibold uppercase tracking-[0.12em] text-ink-700 dark:text-bone-700"
                  >
                    {{ t().mergedWith }}
                  </span>
                  @for (name of mergedAliasNames(); track name) {
                    <span
                      class="rounded-full bg-bone-100 dark:bg-ink-100 px-2 py-0.5"
                      >{{ name }}</span
                    >
                  }
                  <button
                    type="button"
                    class="underline underline-offset-2 hover:text-ink dark:hover:text-bone cursor-pointer bg-transparent border-0 p-0"
                    (click)="unmergeAll()"
                  >
                    {{ t().unmerge }}
                  </button>
                </div>
              }
            }
          </div>
        </div>

        <div class="flex flex-col gap-4 tracks-section">
          <h2
            class="font-body text-xs lg:text-base text-ink-700 dark:text-bone-700 font-semibold tracking-[0.05em] uppercase m-0"
          >
            {{ t().popularSongs }}
          </h2>

          @if (loading()) {
            <div
              class="flex flex-col items-center gap-4 py-10 px-5 text-ink-600 dark:text-bone-600 text-center [animation:fadeIn_300ms_var(--ease)_both]"
            >
              <app-spinner size="md" />
              <span class="text-sm lg:text-lg italic">{{
                t().loadingSongs
              }}</span>
            </div>
          } @else if (tracks().length === 0) {
            <div
              class="text-center py-10 px-5 text-ink-700 dark:text-bone-700 text-sm lg:text-lg [animation:fadeIn_300ms_var(--ease)_both]"
            >
              {{ t().noSongsAvailable }}
            </div>
          } @else {
            <div class="flex flex-col">
              @for (track of tracks(); track track.id; let i = $index) {
                <div
                  class="select-none"
                  (contextmenu)="onTrackContextMenu($event, track)"
                >
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
                    (onMoreClick)="onTrackMoreClick($event)"
                  />
                </div>
              }
            </div>
          }
        </div>

        @if (loadingReleases()) {
          <div
            class="flex flex-col items-center gap-4 py-10 px-5 text-ink-600 dark:text-bone-600 text-center [animation:fadeIn_300ms_var(--ease)_both]"
          >
            <app-spinner size="md" />
            <span class="text-sm lg:text-lg italic">{{ t().loadingReleases }}</span>
          </div>
        } @else {
          @for (section of releaseSections(); track section.title) {
            <div class="flex flex-col gap-4">
              <h2
                class="font-body text-xs lg:text-base text-ink-700 dark:text-bone-700 font-semibold tracking-[0.05em] uppercase m-0"
              >
                {{ section.title }}
              </h2>
              <div class="grid grid-cols-3 lg:grid-cols-4 gap-2 gap-y-3">
                @for (item of section.items; track item.id; let i = $index) {
                  <div
                    class="flex flex-col gap-1 group release-item"
                    [style.animation-delay]="i * 40 + 'ms'"
                  >
                    <div
                      class="w-full aspect-square rounded-md overflow-hidden bg-ink-100 dark:bg-ink-800 cursor-pointer relative"
                      (click)="navigateToAlbum(item.id)"
                      (contextmenu)="onReleaseContextMenu($event, item)"
                    >
                      <app-cover [name]="item.name" [coverUrl]="item.coverUrl" />
                      <div
                        class="absolute bottom-1 right-1 flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                      >
                        <button
                          appBtn
                          variant="add"
                          [added]="isInWishlist(item.id)"
                          (click)="toggleReleaseWishlist($event, item)"
                          class="!w-8 !h-8 lg:!w-11 lg:!h-11 shadow-md border border-solid border-ink-200"
                        >
                          <app-icon
                            [name]="isInWishlist(item.id) ? 'check' : 'plus'"
                            class="w-4 h-4 lg:w-5 lg:h-5"
                          />
                        </button>
                        <button
                          appBtn
                          variant="action"
                          class="!w-8 !h-8 lg:!w-11 lg:!h-11 !bg-bone/90 dark:!bg-ink/90 shadow-md"
                          (click)="onReleaseMoreClick($event, item)"
                        >
                          <app-icon name="more" class="w-4 h-4 lg:w-5 lg:h-5 text-ink dark:text-bone" />
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
          @if (superuser.enabled() && allReleasesForExport().length > 0) {
            <div class="pt-6 pb-2 px-2">
              <button
                class="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-full border border-ink-200 dark:border-bone-700 bg-transparent text-ink-600 dark:text-bone-600 font-medium uppercase text-xs tracking-wide hover:bg-ink hover:text-bone dark:hover:bg-bone dark:hover:text-ink active:scale-[0.98] transition-all"
                (click)="exportAllReleases()"
              >
                <app-icon name="link" class="w-3.5 h-3.5 opacity-60" />
                {{ t().exportAll }}
              </button>
            </div>
          }
        }
      </div>

      <app-modal
        #mergeModal
        [title]="t().mergeArtists"
        (onClose)="closeMergeModal()"
      >
        @if (artist(); as a) {
          <app-artist-merge-picker
            [artist]="{ artistId: a.id, name: a.name }"
            [excludedIds]="mergedAliasIds()"
            (onPick)="mergeArtist($event)"
            (onCancel)="closeMergeModal()"
          />
        }
      </app-modal>

      <app-modal
        #photoModal
        [title]="t().artistPhoto"
        (onClose)="closePhotoModal()"
      >
        @if (artist(); as a) {
          <app-artist-photo-editor
            [artist]="{ artistId: a.id, name: a.name }"
            [currentImage]="artistCoverUrl()"
            [hasOverride]="hasCustomPhoto()"
            (onSave)="saveArtistPhoto($event)"
            (onReset)="resetArtistPhoto()"
            (onCancel)="closePhotoModal()"
          />
        }
      </app-modal>
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
  private artistMergeSvc = inject(ArtistMergeService);
  private artistImageSvc = inject(ArtistImageService);
  private authSvc = inject(AuthService);
  private previewSvc = inject(PreviewService);
  private languageService = inject(LanguageService);
  private destroyRef = inject(DestroyRef);
  private artistCacheSvc = inject(ArtistCacheService);
  private toast = inject(ToastService);
  superuser = inject(SuperuserService);

  @ViewChild('mergeModal') private mergeModal?: ModalComponent;
  @ViewChild(ArtistMergePickerComponent)
  private mergePicker?: ArtistMergePickerComponent;
  @ViewChild('photoModal') private photoModal?: ModalComponent;

  contextMenu = signal<{ x: number; y: number; item: Track | ReleaseItem; kind: 'track' | 'release' } | null>(null);
  private currentArtistId = signal<string | null>(null);

  get isMobile(): boolean {
    return window.innerWidth < 1024;
  }

  t = computed(() => this.languageService.t());

  artist = signal<any>(null);
  tracks = signal<Track[]>([]);
  albums = signal<ReleaseItem[]>([]);
  eps = signal<ReleaseItem[]>([]);
  singles = signal<ReleaseItem[]>([]);
  loading = signal(true);
  loadingReleases = signal(false);
  notFound = signal(false);

  releaseSections = computed(() =>
    [
      { title: 'Albums', items: this.albums() },
      { title: 'EPs', items: this.eps() },
      { title: 'Singles', items: this.singles() },
    ].filter((s) => s.items.length > 0),
  );

  allReleasesForExport = computed(() => this.releaseSections().flatMap((s) => s.items));

  /**
   * Deezer's `nb_album` only counts the releases its (sometimes incomplete)
   * artist album list knows about, so the loaded discography wins once it
   * arrives. `undefined` hides the stat instead of showing a wrong number.
   */
  albumTotal = computed<number | undefined>(() => {
    if (this.loadingReleases()) return undefined;

    const albums = this.albums().length;
    if (albums > 0) return albums;

    const hasOtherReleases = this.eps().length > 0 || this.singles().length > 0;
    return hasOtherReleases ? 0 : this.artist()?.albumCount;
  });

  private mergedAliases = computed(() => {
    const current = this.artist();
    if (!current) return [];
    return this.artistMergeSvc
      .groupMembers(current.id)
      .filter((member) => !member.isPrimary);
  });

  mergedAliasNames = computed(() => this.mergedAliases().map((m) => m.name));
  mergedAliasIds = computed(() => this.mergedAliases().map((m) => m.artistId));

  /** A user-picked photo wins over the one Deezer returns. */
  artistCoverUrl = computed(() => {
    const current = this.artist();
    if (!current) return '';
    return this.artistImageSvc.resolve(current.id, current.coverUrl);
  });

  hasCustomPhoto = computed(() => {
    const current = this.artist();
    return !!current && this.artistImageSvc.hasOverride(current.id);
  });

  constructor() {
    // Reload when the merge set arrives or changes, so a page opened before
    // Firestore answered still ends up with the combined artist.
    effect(() => {
      this.artistMergeSvc.merges();
      const artistId = this.currentArtistId();
      if (artistId) this.loadArtist(artistId);
    });
  }

  ngOnInit() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const artistId = params.get('id');
        if (artistId) this.currentArtistId.set(artistId);
      });
  }

  private loadArtist(artistId: string) {
    const rootId = this.artistMergeSvc.resolveId(artistId);

    // An alias always opens the canonical page, so the header, favorites and
    // releases are the same no matter which profile the user landed on.
    if (rootId !== artistId) {
      this.router.navigate(['/artist', rootId], { replaceUrl: true });
      return;
    }

    const groupIds = this.artistMergeSvc.groupIds(rootId);
    const cacheKey = `${rootId}|${groupIds.join(',')}`;

    if (this.artistCacheSvc.has(cacheKey)) {
      const cached = this.artistCacheSvc.get(cacheKey)!;
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
    this.notFound.set(false);

    const cacheEntry: {
      artist: any;
      tracks: Track[];
      albums: ReleaseItem[];
      eps: ReleaseItem[];
      singles: ReleaseItem[];
    } = { artist: null, tracks: [], albums: [], eps: [], singles: [] };

    this.searchSvc
      .getArtist(rootId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (artistInfo) => {
          if (!artistInfo) {
            this.notFound.set(true);
            this.loading.set(false);
            this.loadingReleases.set(false);
            return;
          }
          this.artist.set(artistInfo);
          cacheEntry.artist = artistInfo;

          const releases$ = groupIds.map((id) =>
            this.searchSvc
              .getArtistReleases(id, this.artistMergeSvc.nameOf(id) || artistInfo.name)
              .pipe(catchError(() => of([] as ReleaseItem[]))),
          );

          forkJoin(releases$)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (groups) => {
                const seen = new Set<string>();
                const releases = groups
                  .flat()
                  .filter((release) => {
                    const key = `${release.id}:${release.type}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  })
                  .sort(
                    (a, b) =>
                      this.releaseTime(b.releaseDate) -
                      this.releaseTime(a.releaseDate),
                  );

                const albums = releases.filter((r) => r.type === 'album');
                const eps = releases.filter((r) => r.type === 'ep');
                const singles = releases.filter((r) => r.type === 'single');

                this.albums.set(albums);
                this.eps.set(eps);
                this.singles.set(singles);
                cacheEntry.albums = albums;
                cacheEntry.eps = eps;
                cacheEntry.singles = singles;
                this.loadingReleases.set(false);
                this.artistCacheSvc.set(cacheKey, cacheEntry);
              },
              error: () => this.loadingReleases.set(false),
            });
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
          this.loadingReleases.set(false);
        },
      });

    const tracks$ = groupIds.map((id) =>
      this.searchSvc
        .getArtistTracks(id, 5)
        .pipe(catchError(() => of([] as Track[]))),
    );

    forkJoin(tracks$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          const seen = new Set<string>();
          const tracks = groups
            .flat()
            .filter((track) => {
              if (seen.has(track.id)) return false;
              seen.add(track.id);
              return true;
            })
            .slice(0, 10);

          this.tracks.set(tracks);
          cacheEntry.tracks = tracks;
          this.loading.set(false);
          this.artistCacheSvc.set(cacheKey, cacheEntry);
        },
        error: () => this.loading.set(false),
      });
  }

  private releaseTime(releaseDate: string | undefined): number {
    const time = releaseDate ? new Date(releaseDate).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }

  openMergeModal(): void {
    this.mergePicker?.reset();
    this.mergeModal?.open();
    this.mergePicker?.focus();
  }

  closeMergeModal(): void {
    this.mergeModal?.close();
  }

  async mergeArtist(picked: {
    artistId: string;
    name: string;
    coverUrl?: string;
  }): Promise<void> {
    const current = this.artist();
    const user = this.authSvc.currentUser();
    if (!current || !user) return;

    const merged = await this.artistMergeSvc.merge(
      { artistId: current.id, name: current.name },
      { artistId: picked.artistId, name: picked.name },
      user,
    );

    this.closeMergeModal();
    if (merged) this.artistCacheSvc.clear();
  }

  async unmergeAll(): Promise<void> {
    const current = this.artist();
    if (!current) return;

    const removed = await this.artistMergeSvc.unmergeGroup(current.id);
    if (removed) this.artistCacheSvc.clear();
  }

  openPhotoModal(): void {
    this.photoModal?.open();
  }

  closePhotoModal(): void {
    this.photoModal?.close();
  }

  async saveArtistPhoto(image: string): Promise<void> {
    const current = this.artist();
    const user = this.authSvc.currentUser();
    if (!current || !user) return;

    const saved = await this.artistImageSvc.setImage(current.id, image, user);
    if (saved) this.closePhotoModal();
  }

  async resetArtistPhoto(): Promise<void> {
    const current = this.artist();
    if (!current) return;

    const removed = await this.artistImageSvc.clearImage(current.id);
    if (removed) this.closePhotoModal();
  }

  isInWishlist(id: string): boolean {
    return this.wishlistSvc.entries().some((e) => e.trackId === id);
  }

  isArtistInWishlist(artistId: string | number): boolean {
    return this.artistMergeSvc
      .groupIds(String(artistId))
      .some((id) => this.favoriteArtistsSvc.artistIds().has(id));
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
    const group = this.artistMergeSvc.groupIds(artistId);
    const existing = this.favoriteArtistsSvc
      .artists()
      .filter((a) => group.includes(a.artistId));

    if (existing.length > 0) {
      for (const artist of existing) {
        if (artist.id) await this.favoriteArtistsSvc.remove(artist.id);
      }
    } else {
      await this.favoriteArtistsSvc.add(
        artistId,
        currentArtist.name,
        currentArtist.coverUrl,
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

  onTrackContextMenu(event: MouseEvent, track: Track): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, item: track, kind: 'track' });
  }

  onTrackMoreClick(event: { item: any; x: number; y: number }): void {
    this.contextMenu.set({ x: event.x, y: event.y, item: event.item as Track, kind: 'track' });
  }

  onReleaseContextMenu(event: MouseEvent, item: ReleaseItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, item, kind: 'release' });
  }

  onReleaseMoreClick(event: MouseEvent, item: ReleaseItem): void {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.contextMenu.set({ x: rect.left, y: rect.bottom, item, kind: 'release' });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  async copyFromContextMenu(): Promise<void> {
    const menu = this.contextMenu();
    if (!menu) return;
    const url =
      menu.kind === 'track'
        ? catalogExternalUrl(menu.item as Track)
        : catalogExternalUrl(menu.item as ReleaseItem);
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

  goToAlbumFromContextMenu(): void {
    const menu = this.contextMenu();
    if (menu?.kind === 'release') {
      this.router.navigate(['/album', (menu.item as ReleaseItem).id]);
    } else if (menu?.kind === 'track' && (menu.item as Track).albumId) {
      this.router.navigate(['/album', (menu.item as Track).albumId!]);
    }
    this.closeContextMenu();
  }

  async exportAllReleases(): Promise<void> {
    const items = this.allReleasesForExport();
    if (!items.length) return;
    const cmds = items
      .map((item) => catalogExportLine(item))
      .filter((line): line is string => Boolean(line))
      .join('\n');
    try {
      await navigator.clipboard.writeText(cmds);
      this.toast.success(this.languageService.t().wishlistExported);
    } catch {
      this.toast.error(this.languageService.t().toastError);
    }
  }

  formatFans = formatFans;
}
