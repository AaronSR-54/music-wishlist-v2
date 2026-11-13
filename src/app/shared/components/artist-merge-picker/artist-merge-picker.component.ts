import {
  Component,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { firstValueFrom, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { SearchService } from '../../../core/api/search.service';
import { ArtistMergeService } from '../../../core/firebase/artist-merge.service';
import { CatalogArtist } from '../../../core/catalog/catalog.models';
import { LanguageService } from '../../../core/i18n/language.service';
import { Track } from '../../models/track.model';
import { CoverComponent } from '../cover/cover.component';
import { formatFans } from '../../utils/format-fans';

/** Extracts a Deezer artist id from an id, a numeric id or a deezer.com URL. */
export function artistIdFromInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const url = /deezer\.com\/(?:[a-z]{2}\/)?artist\/(\d+)/i.exec(trimmed);
  if (url) return `deezer:${url[1]}`;

  const scoped = /^deezer:(\d+)$/i.exec(trimmed);
  if (scoped) return `deezer:${scoped[1]}`;

  if (/^\d+$/.test(trimmed)) return `deezer:${trimmed}`;
  return null;
}

/**
 * Search inside the merge sheet. Besides the normal artist search it accepts a
 * Deezer artist URL or id, because the duplicate record is often missing from
 * Deezer's own search index.
 */
@Component({
  selector: 'app-artist-merge-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, CoverComponent],
  template: `
    <div class="flex flex-col gap-3">
      <p class="m-0 text-sm leading-relaxed text-ink-600 dark:text-bone-600">
        {{ t().mergeArtistsHint }}
      </p>

      <input
        #searchInput
        type="search"
        class="w-full h-12 rounded-lg border border-bone-200 dark:border-ink-200 bg-transparent px-4 text-ink dark:text-bone outline-none focus:border-ink dark:focus:border-bone"
        [placeholder]="t().mergeSearchPlaceholder"
        [attr.aria-label]="t().mergeSearchPlaceholder"
        (input)="onInput($event)"
        (keydown.enter)="confirm()"
      />

      <p class="m-0 text-[0.6875rem] uppercase tracking-[0.12em] font-semibold text-ink-200 dark:text-bone-700">
        {{ t().mergeKeep }} {{ artist().name }}
      </p>

      <div class="min-h-[96px] max-h-[46vh] overflow-y-auto flex flex-col">
        @if (loading()) {
          <span class="py-6 text-center text-sm italic text-ink-600 dark:text-bone-600">
            {{ t().searching }}
          </span>
        } @else if (results().length === 0) {
          <span class="py-6 text-center text-sm italic text-ink-600 dark:text-bone-600">
            {{ t().noResults }}
          </span>
        } @else {
          @for (item of results(); track item.id) {
            <button
              type="button"
              class="flex items-center gap-3 py-2 px-2 rounded-lg text-left transition-colors"
              [ngClass]="
                selected()?.id === item.id
                  ? 'bg-bone-100 dark:bg-ink-100'
                  : 'hover:bg-bone-100 dark:hover:bg-ink-100'
              "
              (click)="select(item)"
            >
              <app-cover
                [coverUrl]="item.coverUrl"
                [name]="item.name"
                [size]="44"
                class="shrink-0 rounded-full overflow-hidden"
              />
              <span class="min-w-0 flex flex-col">
                <span class="truncate font-semibold text-ink dark:text-bone">
                  {{ item.name }}
                </span>
                @if (item.fanCount !== undefined) {
                  <span class="text-xs text-ink-500 dark:text-bone-500">
                    {{ formatFans(item.fanCount) }} {{ t().followers }}
                  </span>
                }
              </span>
            </button>
          }
        }
      </div>

      <div class="flex gap-3 pt-1">
        <button
          type="button"
          class="flex-1 py-3 rounded-lg bg-bone dark:bg-ink-200 text-ink dark:text-bone font-bold uppercase cursor-pointer"
          (click)="onCancel.emit()"
        >
          {{ t().cancel }}
        </button>
        <button
          type="button"
          class="flex-1 py-3 rounded-lg bg-ink dark:bg-bone text-bone dark:text-ink font-bold uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="!selected()"
          (click)="confirm()"
        >
          {{ t().mergeAction }}
        </button>
      </div>
    </div>
  `,
})
export class ArtistMergePickerComponent {
  private search = inject(SearchService);
  private merges = inject(ArtistMergeService);
  private language = inject(LanguageService);

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  artist = input.required<{ artistId: string; name: string }>();
  excludedIds = input<string[]>([]);

  onPick = output<{ artistId: string; name: string; coverUrl?: string }>();
  onCancel = output<void>();

  t = computed(() => this.language.t());
  query = signal('');
  results = signal<Track[]>([]);
  loading = signal(false);
  selected = signal<Track | null>(null);

  private timer?: number;
  private requestId = 0;

  focus(): void {
    setTimeout(() => {
      this.searchInput?.nativeElement.focus();
      this.searchInput?.nativeElement.select();
    });
  }

  reset(): void {
    this.requestId++;
    window.clearTimeout(this.timer);
    this.query.set('');
    this.results.set([]);
    this.selected.set(null);
    this.loading.set(false);
    if (this.searchInput) this.searchInput.nativeElement.value = '';
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.selected.set(null);
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.run(value), 300);
  }

  select(item: Track): void {
    this.selected.set(item);
  }

  confirm(): void {
    const item = this.selected();
    if (!item) return;
    this.onPick.emit({
      artistId: item.id,
      name: item.name,
      coverUrl: item.coverUrl,
    });
  }

  private async run(value: string): Promise<void> {
    const term = value.trim();
    const request = ++this.requestId;

    if (!term) {
      this.results.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    const pastedId = artistIdFromInput(term);

    if (pastedId) {
      const artist = await firstValueFrom(
        this.search.getArtist(pastedId).pipe(catchError(() => of(null))),
      );
      if (request !== this.requestId) return;

      const candidate = artist ? this.toTrack(artist) : null;
      const filtered = candidate ? this.filter([candidate]) : [];
      if (filtered.length > 0) {
        this.results.set(filtered);
        this.loading.set(false);
        return;
      }
    }

    this.search
      .search(term, new Set(['artist']))
      .pipe(take(1), catchError(() => of([] as Track[])))
      .subscribe((items) => {
        if (request !== this.requestId) return;
        this.results.set(this.filter(items).slice(0, 8));
        this.loading.set(false);
      });
  }

  private filter(items: Track[]): Track[] {
    const excluded = new Set<string>([
      this.merges.resolveId(this.artist().artistId),
      ...this.excludedIds().map((id) => this.merges.resolveId(id)),
    ]);

    return items.filter(
      (item) =>
        item.type === 'artist' &&
        !excluded.has(this.merges.resolveId(item.id)),
    );
  }

  private toTrack(artist: CatalogArtist): Track {
    return {
      id: artist.id,
      externalId: artist.externalId,
      provider: artist.provider,
      name: artist.name,
      artists: [artist.name],
      coverUrl: artist.coverUrl,
      type: 'artist',
      uri: artist.uri ?? '',
      fanCount: artist.fanCount,
      albumCount: artist.albumCount,
    };
  }

  formatFans = formatFans;
}
