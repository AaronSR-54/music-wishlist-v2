import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  input,
  output,
  ViewChild,
  computed,
  inject,
  AfterViewInit,
} from '@angular/core';
import { IconComponent } from '../../icons/icon.component';
import { ModalComponent } from '../modal/modal.component';
import { LanguageService } from '../../../core/i18n/language.service';

@Component({
  selector: 'app-context-menu-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ModalComponent],
  template: `
    @if (mobile()) {
      <app-modal #modal [title]="title() || t().options" (onClose)="close()">
        <div class="flex flex-col gap-1">
          <button
            class="flex items-center gap-3 px-4 py-3 font-body text-sm text-ink-200 dark:text-bone-600 italic rounded-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] bg-bone-200 dark:bg-ink-500 hover:font-bold hover:not-italic w-full text-left"
            (click)="handleCopyLink()"
          >
            <app-icon name="link" class="w-4 h-4" />
            <span>{{ t().copyLink }}</span>
          </button>
          @if (showArtist()) {
            <button
              class="flex items-center gap-3 px-4 py-3 font-body text-sm text-ink-200 dark:text-bone-600 italic rounded-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] bg-bone-200 dark:bg-ink-500 hover:font-bold hover:not-italic w-full text-left"
              (click)="handleGoToArtist()"
            >
              <app-icon name="person" class="w-4 h-4" />
              <span>{{ t().goToArtist }}</span>
            </button>
          }
          @if (showAlbum()) {
            <button
              class="flex items-center gap-3 px-4 py-3 font-body text-sm text-ink-200 dark:text-bone-600 italic rounded-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] bg-bone-200 dark:bg-ink-500 hover:font-bold hover:not-italic w-full text-left"
              (click)="handleGoToAlbum()"
            >
              <app-icon name="album" class="w-4 h-4" />
              <span>{{ t().goToAlbum }}</span>
            </button>
          }
          @if (showRemove()) {
            <button
              class="flex items-center gap-3 px-4 py-3 font-body text-sm text-ink italic rounded-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] bg-red-300 dark:bg-red-400 hover:font-bold hover:not-italic w-full text-left"
              (click)="handleRemove()"
            >
              <app-icon name="trash" class="w-4 h-4" />
              <span>{{ t().removeFromWishlist }}</span>
            </button>
          }
        </div>
      </app-modal>
    } @else {
      <div
        class="fixed p-1 bg-bone dark:bg-ink-200 rounded-lg shadow-lg z-50"
        [style.left.px]="adjustedLeft()"
        [style.top.px]="y()"
      >
        <div class="rounded-lg overflow-hidden flex flex-col min-w-[200px]">
          <button
            class="flex items-center gap-2 px-3 py-2 text-sm rounded-md font-body text-ink-200 dark:text-bone-600 italic text-left w-full transition-all duration-150 ease-out hover:bg-ink-200 hover:dark:bg-bone hover:text-bone hover:dark:text-ink hover:tracking-wide [text-shadow:0_0_0_transparent] hover:[text-shadow:0_0_0.25px_currentColor]"
            (click)="handleCopyLink()"
          >
            <app-icon name="link" class="w-4 h-4" />
            <span>{{ t().copyLink }}</span>
          </button>
          @if (showArtist()) {
            <button
              class="flex items-center gap-2 px-3 py-2 text-sm rounded-md font-body text-ink-200 dark:text-bone-600 italic text-left w-full transition-all duration-150 ease-out hover:bg-ink-200 hover:dark:bg-bone hover:text-bone hover:dark:text-ink hover:tracking-wide [text-shadow:0_0_0_transparent] hover:[text-shadow:0_0_0.25px_currentColor]"
              (click)="handleGoToArtist()"
            >
              <app-icon name="person" class="w-4 h-4" />
              <span>{{ t().goToArtist }}</span>
            </button>
          }
          @if (showAlbum()) {
            <button
              class="flex items-center gap-2 px-3 py-2 text-sm rounded-md font-body text-ink-200 dark:text-bone-600 italic text-left w-full transition-all duration-150 ease-out hover:bg-ink-200 hover:dark:bg-bone hover:text-bone hover:dark:text-ink hover:tracking-wide [text-shadow:0_0_0_transparent] hover:[text-shadow:0_0_0.25px_currentColor]"
              (click)="handleGoToAlbum()"
            >
              <app-icon name="album" class="w-4 h-4" />
              <span>{{ t().goToAlbum }}</span>
            </button>
          }
          @if (showRemove()) {
            <button
              class="flex items-center gap-2 px-3 py-2 text-sm rounded-md font-body text-red-700 dark:text-red-400 italic text-left w-full transition-all duration-150 ease-out hover:bg-red-400 hover:dark:bg-red-400 hover:text-ink hover:dark:text-ink-900 hover:tracking-wide [text-shadow:0_0_0_transparent] hover:[text-shadow:0_0_0.25px_currentColor]"
              (click)="handleRemove()"
            >
              <app-icon name="trash" class="w-4 h-4" />
              <span>{{ t().removeFromWishlist }}</span>
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class ContextMenuPanelComponent implements AfterViewInit {
  private languageService = inject(LanguageService);

  x = input.required<number>();
  y = input.required<number>();
  mobile = input(false);
  title = input('');

  t = computed(() => this.languageService.t());
  showRemove = input(false);
  showArtist = input(false);
  showAlbum = input(false);

  onClose = output<void>();
  onCopyLink = output<void>();
  onGoToArtist = output<void>();
  onGoToAlbum = output<void>();
  onRemove = output<void>();

  @ViewChild('modal') modal?: ModalComponent;

  adjustedLeft = computed(() => {
    const panelWidth = 216;
    const margin = 8;
    const x = this.x();
    const viewportWidth = window.innerWidth;
    if (x + panelWidth + margin > viewportWidth) {
      const adjusted = viewportWidth - panelWidth - margin;
      return adjusted < 0 ? 0 : adjusted;
    }
    return x;
  });

  ngAfterViewInit() {
    if (this.mobile() && this.modal) {
      this.modal.open();
    }
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (!this.mobile()) {
      this.onClose.emit();
    }
  }

  close() {
    this.onClose.emit();
  }

  handleCopyLink() {
    this.onCopyLink.emit();
  }

  handleGoToArtist() {
    this.onGoToArtist.emit();
  }

  handleGoToAlbum() {
    this.onGoToAlbum.emit();
  }

  handleRemove() {
    this.onRemove.emit();
  }
}
