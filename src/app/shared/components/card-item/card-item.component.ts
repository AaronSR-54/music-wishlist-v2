import { Component, computed, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { ReleaseItem } from '../../models/release-item.model';
import { CoverComponent } from '../cover/cover.component';
import { TypeChipComponent } from '../type-chip/type-chip.component';
import { PreviewService } from '../../../core/services/preview.service';
import { IconComponent } from '../../icons/icon.component';
import { LanguageService } from '../../../core/i18n/language.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-card-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NgClass,
    CoverComponent,
    TypeChipComponent,
    IconComponent,
    ButtonComponent,
  ],
  styles: `
    .card[data-type='album']:is(:hover, :focus-within) .card-name,
    .card[data-type='album']:is(:hover, :focus-within) .card-artist {
      color: rgb(var(--accent-hover-album));
    }
    .dark .card[data-type='album']:is(:hover, :focus-within) .card-name,
    .dark .card[data-type='album']:is(:hover, :focus-within) .card-artist {
      color: #3aa7a3;
      opacity: 0.8;
    }
    .card[data-type='ep']:is(:hover, :focus-within) .card-name,
    .card[data-type='ep']:is(:hover, :focus-within) .card-artist {
      color: rgb(var(--accent-hover-ep));
    }
    .dark .card[data-type='ep']:is(:hover, :focus-within) .card-name,
    .dark .card[data-type='ep']:is(:hover, :focus-within) .card-artist {
      color: #a37871;
      opacity: 0.8;
    }
    .card[data-type='single']:is(:hover, :focus-within) .card-name,
    .card[data-type='single']:is(:hover, :focus-within) .card-artist {
      color: rgb(var(--accent-hover-track));
    }
    .dark .card[data-type='single']:is(:hover, :focus-within) .card-name,
    .dark .card[data-type='single']:is(:hover, :focus-within) .card-artist {
      color: #ffffc7;
      opacity: 0.8;
    }
    .card-name,
    .card-artist {
      transition:
        color 300ms cubic-bezier(0.4, 0, 0.2, 1),
        opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .card {
      animation: dropIn 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
      transition:
        transform 350ms cubic-bezier(0.16, 1, 0.3, 1),
        box-shadow 350ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .card:hover {
      z-index: 1;
      transform: scale(1.015) translateY(-2px);
      box-shadow: 0 8px 18px rgb(0 0 0 / 0.12);
    }
    .dark .card:hover {
      box-shadow: 0 8px 18px rgb(0 0 0 / 0.32);
    }
    .card:active {
      z-index: 2;
      transform: scale(0.99);
      box-shadow: 0 3px 8px rgb(0 0 0 / 0.16);
    }
    .dark .card:active {
      box-shadow: 0 3px 8px rgb(0 0 0 / 0.3);
    }
    .card.compact {
      padding: 0.375rem;
      gap: 0.25rem;
    }
    .card.compact .card-details {
      gap: 0.25rem;
    }
    .card.compact .card-actions > button {
      width: 2rem !important;
      height: 2rem !important;
    }
  `,
  template: `
    <div
      class="card relative flex flex-col p-2 rounded-lg bg-bone-200 dark:bg-dark/80 gap-1 w-full cursor-pointer"
      [class.compact]="compact()"
      [attr.data-type]="releaseItem().type"
      (click)="onCardClick()"
    >
      <div class="relative">
        <div
          class="relative w-full shrink-0 rounded-md overflow-hidden"
          [title]="releaseItem().name"
        >
          <app-cover
            class="!rounded-md overflow-hidden"
            [coverUrl]="releaseItem().coverUrl"
            [name]="releaseItem().name"
            [rounded]="'rounded-md'"
          />
        </div>
        @if (compact()) {
          @if (showTypeChip()) {
            <div class="absolute right-1.5 top-1.5 scale-90 origin-top-right">
              <app-type-chip
                [type]="releaseItem().type"
                [solid]="true"
                size="cover"
                colorScheme="dark"
              />
            </div>
          }
          <span
            class="absolute bottom-1.5 left-1.5 flex items-baseline gap-0.5 rounded-full px-1 py-0.5 bg-bone-100/70 backdrop-blur-sm font-display text-[0.6rem] leading-none text-ink-600/80"
          >
            <b class="font-bold not-italic text-ink-700/80">{{
              releaseItem().releaseDate | date: 'dd'
            }}</b>
            <em class="font-normal italic lowercase">{{
              releaseItem().releaseDate | date: 'LLL'
            }}</em>
          </span>
        }
      </div>

      <div class="card-details flex flex-col gap-2 min-w-0">
        @if (!compact()) {
          <div
            class="flex items-center justify-between text-ink-800 dark:text-bone-800"
          >
            <span
              class="font-display text-xs sm:text-sm md:text-base text-ink-600 dark:text-bone-600 flex gap-0.5 items-center"
            >
              <b class="font-bold not-italic text-ink-700 dark:text-bone-700">{{
                releaseItem().releaseDate | date: 'dd'
              }}</b>
              <em
                class="italic font-normal text-ink-600 dark:text-bone-600 lowercase"
                >{{ releaseItem().releaseDate | date: 'LLL' }}</em
              >
            </span>
            @if (showTypeChip()) {
              <app-type-chip [type]="releaseItem().type" />
            }
          </div>
        }

        <div class="flex flex-col gap-1">
          <span
            class="card-name font-display text-sm sm:text-base md:text-lg font-semibold text-ink-100 dark:text-bone-100 leading-none truncate max-w-full"
            [ngClass]="playingClass()"
          >
            {{ releaseItem().name }}
          </span>
          <span
            class="card-artist text-xs sm:text-sm md:text-base text-ink-600 dark:text-bone-600 truncate max-w-full"
            [ngClass]="playingClass()"
          >
            {{ releaseItem().artist }}
          </span>
        </div>

        <div class="card-actions flex items-center gap-1.5 md:gap-2 min-w-0">
           <button
            class="flex-1 min-w-0 flex items-center justify-center gap-1 h-10 md:h-12 text-xs sm:text-sm md:text-base text-ink font-display font-medium [&.added]:font-bold [&.added]:bg-ink italic [&.added]:not-italic [&.added]:text-bone [&.added]:dark:bg-bone  dark:text-bone [&.added]:dark:text-ink border border-ink dark:border-bone rounded-card uppercase px-1.5 sm:px-3 md:px-4 overflow-hidden"
            [class.added]="isAdded()"
            (click)="onToggleWishlist(); $event.stopPropagation()"
          >
            @if (isAdded()) {
              <app-icon
                name="check"
                class="w-[18px] h-[18px] md:w-[22px] md:h-[22px] shrink-0"
              />
              <span class="min-w-0 truncate">{{ t().added }}</span>
            } @else {
              <app-icon
                name="plus"
                class="w-[18px] h-[18px] md:w-[22px] md:h-[22px] shrink-0"
              />
              <span class="min-w-0 truncate">{{ t().save }}</span>
            }
          </button>
          <button
            appBtn
            variant="action"
            class="!w-10 !h-10 md:!w-12 md:!h-12 shrink-0"
            (click)="openMoreMenu($event)"
          >
            <app-icon
              name="more"
              class="w-[18px] h-[18px] md:w-[22px] md:h-[22px] text-ink dark:text-bone"
            />
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CardItemComponent {
  private preview = inject(PreviewService);
  private languageService = inject(LanguageService);

  item = input.required<ReleaseItem>();
  isAdded = input(false);
  showTypeChip = input(true);
  compact = input(false);

  toggleWishlist = output<ReleaseItem>();
  onAlbumClick = output<string>();
  onMoreClick = output<{ item: ReleaseItem; x: number; y: number }>();

  t = computed(() => this.languageService.t());
  releaseItem = computed(() => this.item() as ReleaseItem);
  previewState = computed(() => this.preview.state());

  isPlayingCurrentItem = computed(() => {
    const state = this.previewState();
    return (
      state.trackId === this.releaseItem().id ||
      state.parentId === this.releaseItem().id
    );
  });

  playingClass = computed(() => {
    if (!this.isPlayingCurrentItem()) return '';
    const type = this.releaseItem().type;
    if (type === 'ep')
      return '!text-accent-hover-ep dark:!text-accent-dark-ep';
    if (type === 'album')
      return '!text-accent-hover-album dark:!text-accent-dark-album';
    return '!text-accent-hover-track dark:!text-accent-dark-track';
  });

  onToggleWishlist() {
    this.toggleWishlist.emit(this.item());
  }

  onCardClick() {
    if (this.releaseItem().type === 'single') {
      this.onPlayPreview(this.releaseItem());
    } else {
      this.onAlbumClick.emit(this.releaseItem().id);
    }
  }

  openMoreMenu(event: MouseEvent): void {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.onMoreClick.emit({
      item: this.releaseItem(),
      x: rect.left,
      y: rect.bottom,
    });
  }

  async onPlayPreview(item: ReleaseItem) {
    if (!item.previewUrl) return;

    this.preview.play({
      id: item.id,
      title: item.name,
      artist: item.artist,
      cover: item.coverUrl,
      previewUrl: item.previewUrl,
      parentId: item.id,
    });
  }
}
