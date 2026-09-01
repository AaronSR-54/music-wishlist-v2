import { Component, computed, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { ReleaseItem } from '../../models/release-item.model';
import { CoverComponent } from '../cover/cover.component';
import { TypeChipComponent } from '../type-chip/type-chip.component';
import { PreviewService } from '../../../core/services/preview.service';
import { IconComponent } from '../../icons/icon.component';
import { LanguageService } from '../../../core/i18n/language.service';

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
  ],
  styles: `
    .card[data-type='album']:hover .card-name,
    .card[data-type='album']:hover .card-artist {
      color: #0891b2;
      opacity: 0.8;
    }
    .dark .card[data-type='album']:hover .card-name,
    .dark .card[data-type='album']:hover .card-artist {
      color: #3aa7a3;
      opacity: 0.8;
    }
    .card[data-type='ep']:hover .card-name,
    .card[data-type='ep']:hover .card-artist {
      color: #b45309;
      opacity: 0.8;
    }
    .dark .card[data-type='ep']:hover .card-name,
    .dark .card[data-type='ep']:hover .card-artist {
      color: #a37871;
      opacity: 0.8;
    }
    .card[data-type='single']:hover .card-name,
    .card[data-type='single']:hover .card-artist {
      color: #cea219;
      opacity: 0.8;
    }
    .dark .card[data-type='single']:hover .card-name,
    .dark .card[data-type='single']:hover .card-artist {
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
      transform: scale(1.02) translateY(-4px);
      box-shadow: 0 14px 28px rgb(0 0 0 / 0.12);
    }
    .dark .card:hover {
      box-shadow: 0 14px 28px rgb(0 0 0 / 0.38);
    }
  `,
  template: `
    <div
      class="card relative flex flex-col p-2 rounded-lg bg-bone-200 dark:bg-ink-200 gap-1 w-full cursor-pointer"
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
      </div>

      <div class="flex flex-col gap-2 min-w-0">
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
          <app-type-chip [type]="releaseItem().type" />
        </div>

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

        <button
          class="flex items-center text-ink font-display font-medium [&.added]:font-bold [&.added]:bg-ink italic [&.added]:not-italic [&.added]:text-bone [&.added]:dark:bg-bone  dark:text-bone [&.added]:dark:text-ink border border-ink dark:border-bone rounded-card uppercase px-4 py-1"
          [class.added]="isAdded()"
          (click)="onToggleWishlist(); $event.stopPropagation()"
        >
          @if (isAdded()) {
            <app-icon
              name="check"
              class="w-5 h-5 sm:w-6 sm:h-6"
            />
            <span class="flex-1">{{ t().added }}</span>
          } @else {
            <app-icon
              name="plus"
              class="w-5 h-5 sm:w-6 sm:h-6"
            />
            <span class="flex-1">{{ t().save }}</span>
          }
        </button>
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

  toggleWishlist = output<ReleaseItem>();
  onAlbumClick = output<string>();

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
    if (type === 'ep') return '!text-accent-ep dark:!text-accent-dark-ep';
    if (type === 'album')
      return '!text-accent-album dark:!text-accent-dark-album';
    return '!text-accent-track dark:!text-accent-dark-track';
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
