import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { imageFileToDataUrl, ImageFileError, isImageUrl } from '../../utils/image-file';
import { CoverComponent } from '../cover/cover.component';
import { IconComponent } from '../../icons/icon.component';

/**
 * Sheet that replaces the artist picture. Accepts a file from the device or an
 * image URL; the result is stored per user by `ArtistImageService`.
 */
@Component({
  selector: 'app-artist-photo-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoverComponent, IconComponent],
  template: `
    <div class="flex flex-col gap-4">
      <p class="m-0 text-sm leading-relaxed text-ink-600 dark:text-bone-600">
        {{ t().editPhotoHint }}
      </p>

      <div class="flex items-center gap-4">
        <div
          class="shrink-0 w-24 h-24 rounded-full overflow-hidden bg-bone-100 dark:bg-ink-100"
        >
          <app-cover [name]="artist().name" [coverUrl]="preview()" />
        </div>

        <div class="min-w-0 flex flex-col items-start gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 py-2 px-4 rounded-full border border-ink-200 dark:border-bone-700 bg-transparent text-ink dark:text-bone text-xs font-bold uppercase tracking-wide cursor-pointer hover:bg-ink hover:text-bone dark:hover:bg-bone dark:hover:text-ink transition-colors"
            (click)="pickFile()"
          >
            <app-icon name="upload" class="w-4 h-4" />
            {{ t().uploadPhoto }}
          </button>

          @if (hasOverride()) {
            <button
              type="button"
              class="py-1 px-0 bg-transparent border-0 text-xs underline underline-offset-2 text-ink-600 dark:text-bone-600 hover:text-ink dark:hover:text-bone cursor-pointer"
              (click)="reset()"
            >
              {{ t().photoReset }}
            </button>
          }
        </div>
      </div>

      <label class="flex flex-col gap-2">
        <span
          class="text-[0.6875rem] uppercase tracking-[0.12em] font-semibold text-ink-200 dark:text-bone-700"
        >
          {{ t().photoFromUrl }}
        </span>
        <input
          type="url"
          inputmode="url"
          autocomplete="off"
          class="w-full h-11 rounded-lg border border-bone-200 dark:border-ink-200 bg-transparent px-4 text-sm text-ink dark:text-bone outline-none focus:border-ink dark:focus:border-bone"
          [placeholder]="t().photoUrlPlaceholder"
          [value]="url()"
          (input)="onUrlInput($event)"
        />
      </label>

      @if (error()) {
        <p class="m-0 text-sm text-red-600 dark:text-red-400">
          {{ error() }}
        </p>
      }

      <input
        #fileInput
        type="file"
        accept="image/*"
        class="hidden"
        (change)="onFile($event)"
      />

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
          [disabled]="!canSave()"
          (click)="save()"
        >
          {{ busy() ? t().saving : t().photoSave }}
        </button>
      </div>
    </div>
  `,
})
export class ArtistPhotoEditorComponent implements OnInit {
  private language = inject(LanguageService);

  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  artist = input.required<{ artistId: string; name: string }>();
  currentImage = input<string>('');
  hasOverride = input<boolean>(false);

  onSave = output<string>();
  onReset = output<void>();
  onCancel = output<void>();

  t = computed(() => this.language.t());

  preview = signal('');
  url = signal('');
  error = signal('');
  busy = signal(false);

  private initial = '';

  ngOnInit(): void {
    this.initial = this.currentImage();
    this.preview.set(this.initial);
  }

  canSave = computed(
    () => !!this.preview() && this.preview() !== this.initial && !this.busy(),
  );

  pickFile(): void {
    this.fileInput?.nativeElement.click();
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.error.set('');
    this.busy.set(true);
    try {
      const dataUrl = await imageFileToDataUrl(file);
      this.preview.set(dataUrl);
      this.url.set('');
    } catch (error) {
      this.error.set(
        error instanceof ImageFileError && error.reason === 'too-large'
          ? this.t().photoTooLarge
          : this.t().photoUnsupported,
      );
    } finally {
      this.busy.set(false);
    }
  }

  onUrlInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.url.set(value);
    this.error.set('');

    const trimmed = value.trim();
    if (!trimmed) return;

    if (isImageUrl(trimmed)) {
      this.preview.set(trimmed);
    } else {
      this.error.set(this.t().photoInvalidUrl);
    }
  }

  reset(): void {
    this.preview.set(this.initial);
    this.url.set('');
    this.error.set('');
    this.onReset.emit();
  }

  save(): void {
    if (!this.canSave()) return;
    this.onSave.emit(this.preview());
  }
}
