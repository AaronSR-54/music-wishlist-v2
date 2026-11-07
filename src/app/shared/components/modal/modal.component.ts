import {
  Component,
  inject,
  input,
  OnDestroy,
  output,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
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
    <ng-template #modalTemplate>
      <div class="fixed inset-0 z-[9999] flex items-end md:items-center justify-center">
        <div
          class="absolute inset-0 bg-black/40"
          style="animation: fadeIn 250ms cubic-bezier(0.4,0,0.2,1) both"
          (click)="close()"
        ></div>

        <div
          class="modal-panel relative w-full max-w-md rounded-t-3xl md:rounded-3xl bg-light dark:bg-dark p-6 pb-12 md:pb-6 shadow-[0px_-4px_10px_5px_rgb(0_0_0/10%)] dark:shadow-[0px_-4px_10px_5px_rgb(0_0_0/25%)]"
        >
          @if (title()) {
            <div class="flex items-center justify-between mb-4">
              <h2
                class="text-xl font-bold font-display italic text-ink-700 dark:text-bone-700"
              >
                {{ title() }}
              </h2>
            </div>
          }

          <ng-content></ng-content>
        </div>
      </div>
    </ng-template>
  `,
})
export class ModalComponent implements OnDestroy {
  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);

  @ViewChild('modalTemplate') template!: TemplateRef<any>;

  title = input<string>('');
  onClose = output<void>();

  private overlayRef?: OverlayRef;
  private isOpen = false;

  ngOnDestroy() {
    this.overlayRef?.dispose();
  }

  open() {
    if (this.isOpen) return;

    const portal = new TemplatePortal(this.template, this.vcr);

    this.overlayRef = this.overlay.create({
      hasBackdrop: false,
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });

    this.overlayRef.attach(portal);
    this.isOpen = true;
  }

  close() {
    if (!this.isOpen) return;
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
    this.isOpen = false;
    this.onClose.emit();
  }
}
