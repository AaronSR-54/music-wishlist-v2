import {
  Component,
  computed,
  inject,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';

import { fadeInOut } from '../../animations/animations';

import { Track } from '../../models/track.model';
import { WishlistEntry } from '../../models/wishlist-entry.model';
import { ReleaseItem } from '../../models/release-item.model';

import { CoverComponent } from '../cover/cover.component';
import { TypeChipComponent } from '../type-chip/type-chip.component';
import { AvatarComponent } from '../avatar/avatar.component';
import { IconComponent } from '../../icons/icon.component';
import { ButtonComponent } from '../button/button.component';

import { PreviewService } from '../../../core/services/preview.service';
import { SearchService } from '../../../core/api/search.service';
import { LanguageService } from '../../../core/i18n/language.service';

import { formatFans } from '../../utils/format-fans';
import { formatRelativeDate } from '../../utils/format-relative-date';

type SearchItemType = 'artist' | 'track' | 'album' | 'ep' | 'single';
type WishlistEntryExtended = WishlistEntry & {
  isOwner?: boolean;
};

@Component({
  selector: 'app-search-result-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeInOut()],
  imports: [
    NgClass,
    CoverComponent,
    TypeChipComponent,
    AvatarComponent,
    IconComponent,
    ButtonComponent,
  ],
  template: `
    @if (isArtist()) {
      <div
        class="group flex items-center gap-3 py-2.5 border-b border-bone-200 dark:border-ink-200 rounded-md -mx-2 px-2 cursor-pointer transition-colors"
        (click)="onArtistClick.emit(trackItem())"
      >
        <div class="shrink-0 rounded-md overflow-hidden">
          <app-cover
            [coverUrl]="coverUrl()"
            [name]="title()"
            [size]="coverSize()"
          />
        </div>

        <div class="flex-1 flex flex-col gap-2 min-w-0">
          <div class="flex flex-col">
            <span
              class="title truncate transition-colors duration-fast text-md md:text-lg font-semibold text-ink dark:text-bone"
              [ngClass]="accentClasses()"
            >
              {{ title() }}
            </span>

            <div class="flex items-center gap-2 justify-between">
              <span
                class="text-ink-100 dark:text-bone-700 text-sm md:text-md transition-colors duration-fast leading-none"
                [ngClass]="accentClasses()"
              >
                @if (trackItem().fanCount) {
                  <span class="font-semibold">{{
                    formatFans(trackItem().fanCount ?? 0)
                  }}</span>
                  fan{{ trackItem().fanCount !== 1 ? 's' : '' }}
                }
                @if (trackItem().fanCount && trackItem().albumCount) {
                  ·
                }
                @if (trackItem().albumCount) {
                  <i
                    >{{ trackItem().albumCount }}
                    <span class="italic">
                      álbum{{ trackItem().albumCount !== 1 ? 's' : '' }}
                    </span></i
                  >
                }
              </span>

              @if (showTypeChip()) {
                <app-type-chip type="artist" />
              }
            </div>
          </div>
        </div>

        <div class="flex gap-1 shrink-0">
          @if (showAddButton()) {
            <button
              appBtn
              variant="add"
              [added]="isAdded()"
              (click)="onAdd(trackItem(), $event)"
            >
              <app-icon
                [name]="isAdded() ? 'heart-filled' : 'heart'"
                class="w-5 md:w-6 h-5 md:h-6"
              />
            </button>
          }
        </div>
      </div>
    } @else {
      <div
        class="group flex gap-3 py-2.5 border-b border-bone-200 dark:border-ink-200 rounded-md -mx-2 px-2 cursor-pointer transition-colors"
        [ngClass]="showTrackNumber() ? 'items-start' : 'items-center'"
        (click)="handleItemClick()"
      >
        <!-- COVER / TRACK NUMBER -->

        @if (
          showTrackNumber() && trackItem().trackNumber != null && !isWishlist()
        ) {
          <div
            class="shrink-0 w-7 flex justify-end h-full text-ink dark:text-bone"
            [class.opacity-40]="!hasPreview()"
          >
            <span
              class="font-display text-base md:text-lg font-semibold tabular-nums"
              [ngClass]="accentClasses()"
            >
              {{ trackItem().trackNumber }}.
            </span>
          </div>
        } @else {
          <div class="shrink-0 rounded-md overflow-hidden">
            <app-cover
              [coverUrl]="coverUrl()"
              [name]="title()"
              [size]="coverSize()"
            />
          </div>
        }

        <!-- CONTENT -->

        <div class="flex-1 flex flex-col justify-between min-w-0 gap-2">
          <div class="flex flex-col ">
            <span
              class="title truncate transition-colors duration-fast text-md md:text-lg font-semibold text-ink dark:text-bone"
              [ngClass]="accentClasses()"
            >
              {{ title() }}
            </span>

            <div class="flex items-center gap-2 justify-between min-w-0">
              <span
                class="text-ink-100 dark:text-bone-700 text-sm md:text-md overflow-hidden text-ellipsis transition-colors duration-fast leading-none"
                [ngClass]="accentClasses()"
              >
                @if (isWishlist() && (wishlistItem().artistId || isAlbumType(wishlistItem().type))) {
                  <button
                    class="hover:underline hover:text-accent-track dark:hover:text-accent-dark-track transition-colors"
                    (click)="onArtistNameClick($event)"
                  >
                    {{ subtitle() }}
                  </button>
                } @else {
                  {{ subtitle() }}
                }
              </span>

              @if (showTypeChip()) {
                <app-type-chip [type]="itemType()" />
              }
            </div>
          </div>

          @if (isWishlist()) {
            <span
              class="text-[0.6875rem] md:text-sm text-ink-200 dark:text-bone-800 flex items-center gap-1 flex-wrap font-semibold leading-none"
            >
              @if (isShared()) {
                <span class="flex p-1 bg-bone-200 dark:bg-ink-200 rounded">
                  <app-icon
                    name="share"
                    class="w-2 h-2 text-ink dark:text-bone"
                  />
                </span>
              }
              <app-avatar
                [name]="wishlistItem().addedBy"
                class=" contents"
                [size]="14"
              />

              {{ isShared() ? wishlistItem().addedBy : 'Yo' }}
              ·
              <span class="font-display font-normal italic ">
                {{ addedAtFormatted() }}
              </span>
            </span>
          }
        </div>

        <!-- ACTIONS -->

        <div class="flex gap-1 shrink-0">
          @if (isWishlist()) {
            @if (wishlistStatus() === 'pending') {
              <button appBtn variant="action" (click)="markDownloaded($event)">
                <app-icon
                  name="check"
                  class="w-4 md:w-5 h-4 md:h-5 text-ink dark:text-bone"
                />
              </button>
            } @else {
              <button
                appBtn
                variant="action"
                (click)="unmarkDownloaded($event)"
              >
                <app-icon
                  name="chevron-left"
                  class="w-4 md:w-5 h-4 md:h-5 text-ink dark:text-bone"
                />
              </button>
            }
            <button
              appBtn
              variant="action"
              (click)="openMenu($event)"
              (touchstart)="$event.stopPropagation()"
            >
              <app-icon
                name="more"
                class="w-4 md:w-5 h-4 md:h-5 text-ink dark:text-bone"
              />
            </button>
          } @else if (showAddButton()) {
            <button
              appBtn
              variant="add"
              [added]="isAdded()"
              (click)="onAdd(trackItem(), $event)"
            >
              <app-icon [name]="addButtonIcon()" class="w-5 h-5" />
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class SearchResultItemComponent {
  private preview = inject(PreviewService);
  private search = inject(SearchService);
  private languageService = inject(LanguageService);
  private router = inject(Router);

  item = input.required<Track | WishlistEntryExtended | ReleaseItem>();

  source = input<'search' | 'wishlist' | 'releases'>('search');

  type = input<SearchItemType>('track');

  isAdded = input(false);
  showAddButton = input(true);
  showTypeChip = input(true);
  showTrackNumber = input(false);

  wishlistStatus = input<'pending' | 'downloaded'>('pending');

  onArtistClick = output<Track>();
  onAlbumClick = output<string>();
  onAddClick = output<Track>();
  onPlayClick = output<Track>();

  onMarkDownloaded = output<WishlistEntry>();
  onUnmarkDownloaded = output<WishlistEntry>();
  onRemove = output<WishlistEntry>();
  onMenuClick = output<{ entry: WishlistEntry; x: number; y: number }>();

  t = computed(() => this.languageService.t());

  previewState = computed(() => this.preview.state());

  trackItem = computed(() => this.item() as Track);

  wishlistItem = computed(() => this.item() as WishlistEntryExtended);

  releaseItem = computed(() => this.item() as ReleaseItem);

  formatFans = formatFans;

  addedAtFormatted = computed(() => {
    if (!this.isWishlist()) return '';
    return formatRelativeDate(this.wishlistItem().addedAt);
  });

  readonly isWishlist = computed(() => this.source() === 'wishlist');

  readonly isArtist = computed(() => this.type() === 'artist');

  readonly accent = computed(() => {
    const itemType = this.isWishlist() ? this.wishlistItem().type : this.type();

    const map: Record<string, string> = {
      artist: 'artist',
      track: 'track',
      album: 'album',
      ep: 'ep',
      single: 'track',
    };

    return map[itemType] ?? 'track';
  });

  title = computed(() => {
    return this.isWishlist() ? this.wishlistItem().name : this.trackItem().name;
  });

  subtitle = computed(() => {
    return this.isWishlist()
      ? this.wishlistItem().artist
      : this.trackItem().artists?.[0];
  });

  coverUrl = computed(() => {
    return this.isWishlist()
      ? this.wishlistItem().coverUrl
      : this.trackItem().coverUrl;
  });

  itemType = computed(() => {
    return this.isWishlist() ? this.wishlistItem().type : this.trackItem().type;
  });

  hasPreview = computed(() => {
    if (this.isWishlist()) {
      return this.wishlistItem().type === 'track';
    }

    return !!this.trackItem().previewUrl;
  });

  coverSize = computed(() => {
    return this.isWishlist() ? 60 : 50;
  });

  addButtonIcon = computed(() => {
    return this.isAdded() ? 'check' : 'plus';
  });

  isPreviewing = computed(() => {
    if (this.isWishlist()) {
      return this.previewState().trackId === this.wishlistItem().trackId;
    }

    return this.previewState().trackId === this.trackItem().id;
  });

  accentClasses(): string[] {
    const accent = this.accent();

    return [
      `group-hover:text-accent-${accent}`,
      `dark:group-hover:text-accent-dark-${accent}`,
      'group-hover:opacity-80',
      ...(this.isPreviewing()
        ? [`!text-accent-${accent}`, `dark:!text-accent-dark-${accent}`]
        : []),
    ];
  }

  handleItemClick(): void {
    if (this.isWishlist()) {
      this.onWishlistItemClick();
      return;
    }

    switch (this.type()) {
      case 'track':
        this.onPlayPreviewClick(this.trackItem());
        break;

      case 'album':
      case 'ep':
      case 'single':
        this.onAlbumClick.emit(this.trackItem().id);
        break;
    }
  }

  onAdd(track: Track, event: Event): void {
    event.stopPropagation();
    this.onAddClick.emit(track);
  }

  onPlayPreviewClick(track: Track): void {
    this.onPlayClick.emit(track);
    this.onPlayPreview(track);
  }

  onPlayPreview(track: Track): void {
    if (!track.previewUrl) return;

    this.preview.play({
      id: track.id,
      title: track.name,
      artist: track.artists?.[0] ?? '',
      cover: track.coverUrl,
      previewUrl: track.previewUrl,
    });
  }

  onWishlistItemClick(): void {
    const item = this.wishlistItem();

    if (item.type === 'track') {
      this.onPlayPreviewWishlist(item);
      return;
    }

    if (this.isAlbumType(item.type)) {
      this.goToAlbum(item.trackId);
    }
  }

  async onPlayPreviewWishlist(entry: WishlistEntry): Promise<void> {
    const previewUrl = await this.search
      .getTrackPreview(entry.trackId)
      .toPromise();

    if (!previewUrl) return;

    this.preview.play({
      id: entry.trackId,
      title: entry.name,
      artist: entry.artist,
      cover: entry.coverUrl,
      previewUrl,
    });
  }

  markDownloaded(event: Event): void {
    event.stopPropagation();
    this.onMarkDownloaded.emit(this.wishlistItem());
  }

  unmarkDownloaded(event: Event): void {
    event.stopPropagation();
    this.onUnmarkDownloaded.emit(this.wishlistItem());
  }

  removeWishlistItem(event: Event): void {
    event.stopPropagation();
    this.onRemove.emit(this.wishlistItem());
  }

  onArtistNameClick(event: MouseEvent): void {
    event.stopPropagation();
    const item = this.wishlistItem();
    if (item.artistId) {
      this.onArtistClick.emit({ id: item.artistId, artistId: item.artistId } as Track);
    } else if (this.isAlbumType(item.type) && item.trackId) {
      this.search.getAlbum(item.trackId).subscribe((album) => {
        if (album?.artistId) {
          this.onArtistClick.emit({ id: album.artistId, artistId: album.artistId } as Track);
        }
      });
    }
  }

  onAlbumNameClick(event: MouseEvent): void {
    event.stopPropagation();
    const item = this.wishlistItem();
    if (item.albumId) {
      this.onAlbumClick.emit(item.albumId);
    }
  }

  openMenu(event: MouseEvent): void {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.onMenuClick.emit({
      entry: this.wishlistItem(),
      x: rect.left,
      y: rect.bottom,
    });
  }

  isShared(): boolean {
    return this.wishlistItem().isOwner === false;
  }

  isAlbumType(type: string): boolean {
    return ['album', 'ep', 'single'].includes(type);
  }

  goToAlbum(albumId: string): void {
    this.router.navigate(['/album', albumId]);
  }
}
