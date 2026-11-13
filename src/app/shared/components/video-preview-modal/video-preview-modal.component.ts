import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { Track } from '../../models/track.model';
import { parseCatalogId } from '../../../core/catalog/catalog-id';
import { LanguageService } from '../../../core/i18n/language.service';
import { IconComponent } from '../../icons/icon.component';
import {
  YouTubePlayerInstance,
  loadYouTubeApi,
} from '../../utils/youtube-api';

/**
 * Mobile-style sheet that plays a YouTube video in place (no tab jump).
 * It is opened by `VideoPreviewService` from any result row.
 *
 * Playback starts automatically. Browsers often refuse autoplay with sound
 * inside a cross-origin iframe, so the player retries muted and offers an
 * "enable sound" button instead of leaving the video paused.
 */
@Component({
  selector: 'app-video-preview-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  styles: `
    .modal-panel {
      animation: sheetUp 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @media (min-width: 768px) {
      .modal-panel {
        animation: dialogIn 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
    }
    @keyframes dialogIn {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `,
  template: `
    <div class="fixed inset-0 z-[9999] flex items-end md:items-center justify-center">
      <div
        class="absolute inset-0 bg-black/60"
        style="animation: fadeIn 250ms cubic-bezier(0.4,0,0.2,1) both"
        (click)="close()"
      ></div>

      <div
        class="modal-panel relative w-full max-w-3xl rounded-t-3xl md:rounded-3xl bg-light dark:bg-dark p-4 pb-10 md:pb-4 shadow-[0px_-4px_10px_5px_rgb(0_0_0/10%)] dark:shadow-[0px_-4px_10px_5px_rgb(0_0_0/25%)]"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="video().name"
      >
        <div class="flex items-start justify-between gap-4 mb-3">
          <div class="min-w-0">
            <p
              class="text-[0.6875rem] uppercase tracking-[0.14em] font-semibold text-ink-200 dark:text-bone-700"
            >
              {{ t().video }}
            </p>
            <h2
              class="text-lg md:text-xl font-bold font-display italic text-ink-700 dark:text-bone-700 truncate"
            >
              {{ video().name }}
            </h2>
            @if (video().artists[0]) {
              <p
                class="text-sm text-ink-100 dark:text-bone-700 truncate leading-snug"
              >
                {{ video().artists[0] }}
              </p>
            }
          </div>

          <button
            type="button"
            class="shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-ink-200 dark:text-bone-700 hover:bg-bone-100 dark:hover:bg-ink-100 transition-colors"
            [attr.aria-label]="t().close"
            (click)="close()"
          >
            <app-icon name="close" class="w-4 h-4" />
          </button>
        </div>

        <div class="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
          @if (videoId()) {
            <div #playerHost class="w-full h-full"></div>

            @if (useIframe()) {
              <iframe
                class="absolute inset-0 w-full h-full"
                [src]="embedUrl()"
                [title]="video().name"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
              ></iframe>
            }

            @if (showUnmute()) {
              <button
                type="button"
                class="absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm cursor-pointer transition-transform duration-fast hover:scale-[1.03] active:scale-[0.97]"
                (click)="enableSound()"
              >
                <app-icon name="volume" class="w-4 h-4" />
                {{ t().enableSound }}
              </button>
            }
          } @else {
            <div
              class="w-full h-full flex flex-col items-center justify-center gap-3 text-bone-500"
            >
              <app-icon name="external-link" class="w-6 h-6" />
              <span class="text-sm italic">{{ t().videoUnavailable }}</span>
            </div>
          }
        </div>

        @if (video().uri) {
          <a
            [href]="video().uri"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-200 dark:text-bone-700 hover:text-accent-hover-track dark:hover:text-accent-dark-track transition-colors"
          >
            <app-icon name="external-link" class="w-4 h-4" />
            {{ t().watchOnYouTube }}
          </a>
        }
      </div>
    </div>
  `,
})
export class VideoPreviewModalComponent implements AfterViewInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly language = inject(LanguageService);

  @ViewChild('playerHost') private playerHost?: ElementRef<HTMLDivElement>;

  video = input.required<Track>();
  onClose = output<void>();

  t = computed(() => this.language.t());

  readonly videoId = computed(() => this.readYouTubeId(this.video()));

  readonly embedUrl = computed<SafeResourceUrl | null>(() => {
    const id = this.videoId();
    if (!id) return null;
    const url = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
      id,
    )}?autoplay=1&rel=0&playsinline=1`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  /** Used only when the IFrame API cannot be loaded. */
  useIframe = signal(false);
  showUnmute = signal(false);

  private player?: YouTubePlayerInstance;
  private autoplayCheck?: number;
  private destroyed = false;

  ngAfterViewInit(): void {
    const videoId = this.videoId();
    if (!videoId || !this.playerHost) return;
    void this.createPlayer(videoId);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.autoplayCheck);
    try {
      this.player?.destroy();
    } catch {
      // The player may already be gone when the overlay is disposed twice.
    }
    this.player = undefined;
  }

  private async createPlayer(videoId: string): Promise<void> {
    try {
      const api = await loadYouTubeApi();
      if (this.destroyed || !this.playerHost) return;

      this.player = new api.Player(this.playerHost.nativeElement, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => this.startPlayback(),
          onStateChange: (event) => this.onPlayerState(event.data),
          onError: () => this.useIframe.set(true),
        },
      });
    } catch {
      // Network blocked or the API changed: keep the plain iframe player.
      this.useIframe.set(true);
    }
  }

  /** Tries to play with sound and falls back to muted autoplay if blocked. */
  private startPlayback(): void {
    const player = this.player;
    if (!player) return;

    player.playVideo();

    this.autoplayCheck = window.setTimeout(() => {
      if (!this.player) return;
      const state = this.player.getPlayerState();
      if (state === 1 || state === 3) return; // playing or buffering

      this.player.mute();
      this.player.playVideo();
      this.showUnmute.set(true);
    }, 1400);
  }

  private onPlayerState(state: number): void {
    if (state !== 1) return;
    window.clearTimeout(this.autoplayCheck);
    this.showUnmute.set(this.player?.isMuted() ?? false);
  }

  enableSound(): void {
    const player = this.player;
    if (!player) return;

    player.unMute();
    player.setVolume(100);
    this.showUnmute.set(false);

    // Some browsers keep the player muted after a rejected unmute.
    window.setTimeout(() => {
      if (this.player?.isMuted()) this.showUnmute.set(true);
    }, 400);
  }

  private readYouTubeId(video: Track): string {
    if (video.externalId) return video.externalId;

    const parsed = parseCatalogId(video.id);
    if (parsed?.provider === 'youtube') return parsed.externalId;

    const match = /[?&]v=([\w-]+)/.exec(video.uri ?? '');
    return match?.[1] ?? '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.onClose.emit();
  }
}
