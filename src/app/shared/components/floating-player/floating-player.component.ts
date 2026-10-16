import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CoverComponent } from '../cover/cover.component';
import { IconComponent } from '../../icons/icon.component';
import { PreviewService } from '../../../core/services/preview.service';

@Component({
  selector: 'app-floating-player',
  standalone: true,
  imports: [CoverComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'fixed floating-player-offset md:top-2 z-50 left-2 right-2 md:left-1/2 md:right-auto md:w-[30rem] md:-translate-x-1/2 animate-slide-up',
  },
  template: `
    <div
      class="flex items-center gap-3 p-2.5 rounded-xl bg-light/95 dark:bg-dark/95 backdrop-blur-sm shadow-lg overflow-hidden w-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
    >
      <app-cover
        [name]="metadata()?.title ?? ''"
        [coverUrl]="metadata()?.cover ?? ''"
        [size]="36"
        rounded="rounded-full"
      />

      <div class="flex flex-col flex-1 min-w-0 pr-2 w-full">
        <span
          class="text-md font-medium text-ink dark:text-bone truncate w-full"
        >
          {{ metadata()?.title }}
        </span>
        <span class="text-xs text-ink-600 dark:text-bone-800 truncate w-full">
          {{ metadata()?.artist }}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <button
          (click)="stop()"
          class="w-8 h-8 flex items-center justify-center transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-115 active:scale-90 opacity-60 hover:opacity-100"
          title="Stop"
        >
          <app-icon
            name="stop"
            class="w-8 h-8 fill-ink dark:fill-bone"
          />
        </button>

        <button
          (click)="togglePlay()"
          class="w-10 h-10 flex items-center justify-center rounded-full bg-ink dark:bg-bone text-bone dark:text-ink transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-92 shadow-md hover:shadow-lg"
          title="{{ isPlaying() ? 'Pause' : 'Play' }}"
        >
          <app-icon [name]="isPlaying() ? 'pause' : 'play'" class="w-5 h-5 transition-none" />
        </button>

        <div
          class="absolute bottom-[2px] left-0 right-0 flex justify-center px-6"
        >
          <div
            class="h-[3px] w-full rounded-full bg-bone-400/20 dark:bg-ink-200/20 overflow-hidden"
          >
            <div
              class="h-full rounded-full bg-ink dark:bg-bone transition-[width] duration-200 ease-linear"
              [style.width.%]="progress()"
            ></div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class FloatingPlayerComponent {
  private preview = inject(PreviewService);

  metadata = computed(() => this.preview.state().metadata);
  isPlaying = computed(() => this.preview.state().isPlaying);
  progress = computed(() => this.preview.state().progress);

  togglePlay() {
    this.preview.toggle();
  }

  stop() {
    this.preview.stop();
  }
}
