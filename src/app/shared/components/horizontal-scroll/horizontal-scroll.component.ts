import {
  Component,
  Input,
  signal,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  AfterViewInit,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-horizontal-scroll',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .scroll-container {
        display: flex;
        align-items: center;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scroll-snap-type: x proximity;
        padding-inline: 12px;
        scrollbar-width: none;
        -ms-overflow-style: none;
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
        width: 110px;
        margin: 0 4px;
        transition:
          transform 0.35s ease,
          opacity 0.35s ease,
          box-shadow 0.35s ease;
        opacity: 0.4;
        transform: scale(0.8) translateY(20px);
      }
      ::ng-deep .scroll-item:first-child {
        margin-left: 0;
      }
      ::ng-deep .scroll-item:last-child {
        margin-right: 0;
      }
      ::ng-deep .scroll-item.is-visible {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    `,
  ],
  template: `
    <div #scrollContainer class="scroll-container" (scroll)="onScroll()">
      <ng-content />
    </div>
  `,
})
export class HorizontalScrollComponent implements AfterViewInit {
  @Input() visibleThreshold = 0.6;

  visibleIndices = signal<number[]>([]);

  private rafPending = false;

  ngAfterViewInit() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.checkVisibility();
      });
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.scheduleVisibilityCheck();
  }

  onScroll() {
    this.scheduleVisibilityCheck();
  }

  private scheduleVisibilityCheck() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.checkVisibility();
    });
  }

  checkVisibility() {
    const container =
      this.el?.nativeElement?.querySelector('.scroll-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerLeft = containerRect.left;
    const containerRight = containerRect.right;
    const items = container.querySelectorAll('.scroll-item');
    const visible: number[] = [];

    items.forEach((item: HTMLElement, index: number) => {
      const rect = item.getBoundingClientRect();
      const itemLeft = rect.left;
      const itemRight = rect.right;
      const isVisible =
        itemRight > containerLeft + 20 && itemLeft < containerRight - 20;
      item.classList.toggle('is-visible', isVisible);
      if (isVisible) visible.push(index);
    });

    this.visibleIndices.set(visible);
  }

  constructor(private el: ElementRef) {}
}
