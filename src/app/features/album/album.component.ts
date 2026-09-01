import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { SearchService } from '../../core/api/search.service';
import { WishlistService } from '../../core/firebase/wishlist.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  PreviewService,
  TrackMetadata,
} from '../../core/services/preview.service';
import { AlbumTrack } from '../../shared/models/release-item.model';
import { CoverComponent } from '../../shared/components/cover/cover.component';
import { TypeChipComponent } from '../../shared/components/type-chip/type-chip.component';
import { SearchResultItemComponent } from '../../shared/components/search-result-item/search-result-item.component';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { IconComponent } from '../../shared/icons/icon.component';
import { LanguageService } from '../../core/i18n/language.service';
import { formatDuration } from '../../shared/utils/format-duration';
import { Track, TrackType } from '../../shared/models/track.model';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ReleaseItem } from '../../shared/models/release-item.model';

interface AlbumDetail {
  id: string;
  name: string;
  artist: string;
  artistId?: string;
  coverUrl: string;
  type: TrackType;
  releaseDate: string;
}

@Component({
  selector: 'app-album',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CoverComponent,
    TypeChipComponent,
    SearchResultItemComponent,
    IconComponent,
    ButtonComponent,
    PageHeaderComponent,
    LoadingSpinnerComponent,
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
    /* Cover: llega desde la derecha */
    .album-cover {
      animation: coverFromRight 650ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    /* Info: desciende desde arriba */
    .album-info {
      animation: slideDown 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: 80ms;
    }
    /* Tracklist: aparece por último */
    .album-tracks {
      animation: driftUp 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: 200ms;
    }
  `,
  template: `
    <div class="flex flex-col h-full overflow-hidden p-0.5 pt-2 gap-4">
      <app-page-header
        prefix="02/"
        [title]="album() ? t().album : t().album"
        [backLabel]="t().back"
        (back)="goBack()"
      />

      <div class="scroll-fade flex flex-col p-2 gap-12">
        @if (loading()) {
          <app-loading-spinner [message]="t().loadingSongs" />
        } @else if (album(); as a) {
          <div
            class="flex gap-2 max-md:flex-col max-md:items-center md:gap-8 max-md:text-center mt-4"
          >
            <div
              class="shrink-0 w-[200px] h-[200px] rounded-md overflow-hidden max-md:w-3/4 max-md:h-auto max-md:aspect-square shadow-ink/5 shadow-lg album-cover"
            >
              <app-cover [name]="a.name" [coverUrl]="a.coverUrl" />
            </div>

            <div class="flex-1 flex flex-col justify-start album-info">
              <div class="flex flex-col text-ink dark:text-bone">
                <div
                  class="flex items-center gap-4 mb-2 md:mb-8 max-md:justify-center"
                >
                  <app-type-chip [type]="albumType()" />
                </div>

                <div class="flex items-center justify-center gap-4 md:gap-4">
                  <h1
                    class="m-0 text-2xl md:text-5xl font-bold font-display md:flex-1"
                  >
                    {{ a.name }}
                  </h1>
                  @if (tracks().length > 1) {
                    <button
                      appBtn
                      variant="add"
                      [added]="isAlbumInWishlist()"
                      (click)="toggleWishlist()"
                      class="hidden md:block leading-none"
                    >
                      @if (isAlbumInWishlist()) {
                        <app-icon name="check" class="w-5 h-5" />
                      } @else {
                        <app-icon name="plus" class="w-5 h-5" />
                      }
                    </button>
                  }
                </div>

                <div
                  class="flex items-center gap-2 max-md:justify-center mb-4 md:mb-0"
                >
                  @if (a.artistId) {
                    <a
                      class="text-base md:text-xl text-accent-artist dark:text-bone-700 hover:underline cursor-pointer"
                      (click)="goToArtist(a.artistId)"
                    >
                      {{ a.artist }}
                    </a>
                  } @else {
                    <span
                      class="text-base md:text-xl text-ink-700 dark:text-bone-700"
                    >
                      {{ a.artist }}
                    </span>
                  }
                  <span class="text-ink-600 dark:text-bone-600">·</span>
                  <span
                    class="text-sm md:text-lg text-ink-600 dark:text-bone-600"
                  >
                    {{ a.releaseDate | date: 'd MMM yyyy' }}
                  </span>
                </div>

                @if (tracks().length > 1) {
                  <button
                    appBtn
                    variant="add"
                    [added]="isAlbumInWishlist()"
                    (click)="toggleWishlist()"
                    class="md:hidden mx-auto leading-none"
                  >
                    @if (isAlbumInWishlist()) {
                      <app-icon name="check" class="w-5 h-5 " />
                    } @else {
                      <app-icon name="plus" class="w-5 h-5 " />
                    }
                  </button>
                }
              </div>
            </div>
          </div>

          @if (tracks().length > 0) {
            <div class="flex flex-col gap-4">
              <h2
                class="font-body text-xs md:text-base text-ink-700 dark:text-bone-700 font-semibold tracking-[0.05em] uppercase m-0"
              >
                {{ t().tracks }} ({{ tracks().length }})
              </h2>

              <div class="flex flex-col">
                @for (track of trackList(); track track.id; let i = $index) {
                  <app-search-result-item
                    [style.animation]="
                      'trackRight 450ms cubic-bezier(0.16,1,0.3,1) both'
                    "
                    [style.animation-delay]="i * 30 + 'ms'"
                    [item]="track"
                    type="track"
                    [isAdded]="isInWishlist(track.id)"
                    [showAddButton]="true"
                    [showTypeChip]="false"
                    [showTrackNumber]="true"
                    (onAddClick)="toggle($event)"
                    (onPlayClick)="onTrackPlayClicked($event)"
                  />
                }
              </div>
            </div>
          } @else {
            <div
              class="text-center py-10 px-5 text-ink-700 dark:text-bone-700 text-sm md:text-lg"
            >
              {{ t().noSongsAvailable }}
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class AlbumComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private searchSvc = inject(SearchService);
  private wishlistSvc = inject(WishlistService);
  private authSvc = inject(AuthService);
  private previewSvc = inject(PreviewService);
  private languageService = inject(LanguageService);

  t = computed(() => this.languageService.t());
  previewState = computed(() => this.previewSvc.state());

  album = signal<AlbumDetail | null>(null);
  tracks = signal<AlbumTrack[]>([]);
  loading = signal(true);

  private albumId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
  );

  private autoAdd = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('add') === 'true')),
  );

  albumType = computed(() => {
    const a = this.album();
    if (!a) return 'album' as TrackType;
    return this.tracks().length === 1 ? ('single' as TrackType) : a.type;
  });

  trackList = computed(() => {
    const albumData = this.album();
    return this.tracks().map((t) => ({
      id: t.id,
      name: t.title,
      artists: albumData ? [albumData.artist] : [],
      coverUrl: albumData?.coverUrl || '',
      type: 'track' as TrackType,
      uri: '',
      previewUrl: t.previewUrl,
      trackNumber: t.trackNumber,
    }));
  });

  constructor() {
    effect(() => {
      const id = this.albumId();
      if (id) {
        this.loadAlbum(id);
      }
    });

    // Auto-add to wishlist when navigated from a push notification action.
    // user() is included so the effect re-runs once Firebase Auth resolves —
    // the app may open before auth state is restored from the notification click.
    effect(() => {
      const shouldAdd = this.autoAdd();
      const album = this.album();
      const loading = this.loading();
      const user = this.authSvc.currentUser();
      if (shouldAdd && album && !loading && user && !this.isAlbumInWishlist()) {
        this.toggleWishlist();
      }
    });
  }

  private loadAlbum(albumId: string) {
    this.loading.set(true);

    this.searchSvc.getAlbum(albumId).subscribe({
      next: (albumData) => {
        if (albumData) {
          this.album.set(albumData);
        }
      },
    });

    this.searchSvc.getAlbumTracks(albumId).subscribe({
      next: (tracks) => {
        this.tracks.set(tracks);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  isInWishlist(trackId: string): boolean {
    return this.wishlistSvc.entries().some((e) => e.trackId === trackId);
  }

  isAlbumInWishlist(): boolean {
    const currentAlbum = this.album();
    if (!currentAlbum) return false;
    return this.wishlistSvc
      .entries()
      .some((e) => e.trackId === currentAlbum.id);
  }

  async toggleWishlist() {
    const currentAlbum = this.album();
    const user = this.authSvc.currentUser();
    if (!currentAlbum || !user) return;

    const existing = this.wishlistSvc
      .entries()
      .find((e) => e.trackId === currentAlbum.id);

    if (existing && existing.id) {
      await this.wishlistSvc.remove(existing.id);
    } else {
      const releaseItem: ReleaseItem = {
        id: currentAlbum.id,
        name: currentAlbum.name,
        artist: currentAlbum.artist,
        coverUrl: currentAlbum.coverUrl,
        type: this.albumType(),
        releaseDate: currentAlbum.releaseDate,
        ...(currentAlbum.artistId ? { artistId: currentAlbum.artistId } : {}),
      };
      await this.wishlistSvc.addRelease(releaseItem, user);
    }
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

  playPreview() {
    const currentAlbum = this.album();
    if (!currentAlbum) return;

    const playlist = this.buildPlaylist(currentAlbum);
    if (playlist.length === 0) return;

    this.previewSvc.play(playlist[0]);
  }

  onTrackPlayClicked(track: Track) {
    const currentAlbum = this.album();
    if (!currentAlbum) return;

    const playlist = this.buildPlaylist(currentAlbum);
    const idx = playlist.findIndex((p) => p.id === track.id);
  }

  private buildPlaylist(album: AlbumDetail): TrackMetadata[] {
    return this.tracks()
      .filter((t) => t.previewUrl)
      .map((t) => ({
        id: t.id,
        title: t.title,
        artist: album.artist,
        cover: album.coverUrl,
        previewUrl: t.previewUrl!,
        parentId: album.id,
      }));
  }

  formatDuration = formatDuration;

  goBack() {
    this.location.back();
  }

  goToArtist(artistId: string | undefined) {
    if (artistId) {
      this.router.navigate(['/', 'artist', artistId]);
    }
  }
}
