import {
  Component,
  Input,
  signal,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  AfterViewInit,
  HostListener,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-horizontal-scroll',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  host: {
    '[class.is-bleeding]': 'bleed > 0',
    '[style.width]': "bleed > 0 ? 'calc(100% + ' + bleed + 'px)' : '100%'",
  },
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        --rail-item: clamp(160px, 24vw, 280px);
      }
      .scroll-container {
        position: relative;
        display: flex;
        align-items: center;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scroll-snap-type: x mandatory;
        padding-block: 8px;
        padding-inline: calc(50% - var(--rail-item) / 2);
        scrollbar-width: none;
        -ms-overflow-style: none;
        -webkit-mask-image: linear-gradient(
          to right,
          transparent 0,
          #000 24px,
          #000 calc(100% - 24px),
          transparent 100%
        );
        mask-image: linear-gradient(
          to right,
          transparent 0,
          #000 24px,
          #000 calc(100% - 24px),
          transparent 100%
        );
      }
      .scroll-container::-webkit-scrollbar {
        display: none;
      }
      @media (min-width: 768px) {
        .scroll-container {
          scrollbar-width: thin;
          -ms-overflow-style: auto;
        }
        .scroll-container::-webkit-scrollbar {
          display: block;
          height: 6px;
        }
        .scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .scroll-container::-webkit-scrollbar-thumb {
          background: rgba(128, 128, 128, 0.4);
          border-radius: 3px;
        }
      }
      ::ng-deep .scroll-item {
        flex-shrink: 0;
        scroll-snap-align: center;
        scroll-snap-stop: always;
        width: var(--rail-item);
        margin: 0 4px;
        transform-origin: center center;
        will-change: transform, opacity;
        backface-visibility: hidden;
      }
      ::ng-deep .scroll-item:first-child {
        margin-left: 0;
      }
      ::ng-deep .scroll-item:last-child {
        margin-right: 0;
      }
    `,
  ],
  template: `
    <div #scrollContainer class="scroll-container" (scroll)="onScroll()">
      <ng-content />
    </div>
  `,
})
export class HorizontalScrollComponent implements AfterViewInit, OnDestroy {
  /** Extra pixels the rail overflows to the right of its container. */
  @Input() bleed = 0;

  visibleIndices = signal<number[]>([]);

  private rafPending = false;
  private observer?: MutationObserver;
  private el = inject(ElementRef<HTMLElement>);

  ngAfterViewInit() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.checkVisibility();
        this.observeChildren();
      });
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  @HostListener('window:resize')
  onResize() {
    this.scheduleVisibilityCheck();
  }

  onScroll() {
    this.scheduleVisibilityCheck();
  }

  private observeChildren() {
    const container = this.container();
    if (!container || this.observer) return;

    this.observer = new MutationObserver(() => this.scheduleVisibilityCheck());
    this.observer.observe(container, { childList: true, subtree: true });
  }

  private container(): HTMLElement | null {
    return this.el.nativeElement.querySelector('.scroll-container');
  }

  private scheduleVisibilityCheck() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.checkVisibility();
    });
  }

  /**
   * Material 3 centered-hero behaviour: the item in the middle of the rail is
   * the large one; the further an item is from the centre, the smaller and
   * more transparent it gets. Recomputed on every scroll frame.
   */
  checkVisibility() {
    const container = this.container();
    if (!container) return;

    const viewportCenter = container.scrollLeft + container.clientWidth / 2;
    const itemSize = container.querySelector<HTMLElement>('.scroll-item')
      ?.offsetWidth ?? container.clientWidth;
    // Distance at which an item reaches its smallest size.
    const falloff = Math.max(itemSize * 1.8, container.clientWidth * 0.42, 1);
    const items = container.querySelectorAll<HTMLElement>('.scroll-item');
    const visible: number[] = [];

    items.forEach((item: HTMLElement, index: number) => {
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      const distance = Math.abs(itemCenter - viewportCenter);
      const t = Math.min(distance / falloff, 1);
      // ease-out so the neighbour drops quickly, then flattens
      const eased = 1 - Math.pow(1 - t, 2);
      const scale = 1 - 0.3 * eased;
      const opacity = 1 - 0.35 * eased;

      item.style.transform = `scale(${scale.toFixed(3)})`;
      item.style.opacity = opacity.toFixed(3);

      if (distance < container.clientWidth / 2 + itemSize / 2) {
        visible.push(index);
      }
    });

    this.visibleIndices.set(visible);
  }
}
