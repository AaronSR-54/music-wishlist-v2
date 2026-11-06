import {
  Injectable,
  inject,
  signal,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApplicationRef } from '@angular/core';
import { IconComponent } from '../../icons/icon.component';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  isRemoving?: boolean;
  action?: { label: string; fn: () => void };
  count?: number;
  pluralMessage?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private activeToast = signal<Toast | null>(null);
  currentToast = this.activeToast.asReadonly();
  private appRef = inject(ApplicationRef);
  private queue: Toast[] = [];
  private nextId = 0;

  show(
    message: string,
    type: ToastType = 'info',
    pluralMessage?: string,
  ): void {
    this.enqueue({
      id: this.nextId++,
      message,
      type,
      isRemoving: false,
      pluralMessage,
    });
  }

  success(message: string, pluralMessage?: string): void {
    this.show(message, 'success', pluralMessage);
  }

  error(message: string, pluralMessage?: string): void {
    this.show(message, 'error', pluralMessage);
  }

  info(message: string, pluralMessage?: string): void {
    this.show(message, 'info', pluralMessage);
  }

  showWithAction(
    message: string,
    action: { label: string; fn: () => void },
    type: ToastType = 'info'
  ): void {
    this.enqueue({
      id: this.nextId++,
      message,
      type,
      isRemoving: false,
      action,
    });
  }

  private enqueue(toast: Toast): void {
    const active = this.activeToast();
    if (active && !active.isRemoving && this.isSameEvent(active, toast)) {
      this.activeToast.set({
        ...active,
        count: (active.count ?? 1) + 1,
        pluralMessage: active.pluralMessage ?? toast.pluralMessage,
      });
      this.appRef.tick();
      return;
    }

    const queued = this.queue.find((item) => this.isSameEvent(item, toast));
    if (queued) {
      queued.count = (queued.count ?? 1) + 1;
      queued.pluralMessage ??= toast.pluralMessage;
      return;
    }

    this.queue.push(toast);
    this.showNext();
  }

  private isSameEvent(first: Toast, second: Toast): boolean {
    return (
      first.message === second.message &&
      first.type === second.type &&
      first.action?.label === second.action?.label
    );
  }

  private showNext(): void {
    if (this.activeToast() || this.queue.length === 0) return;

    const toast = this.queue.shift()!;
    this.activeToast.set(toast);
    this.appRef.tick();

    // Include the 500ms exit animation in the toast's short display window.
    setTimeout(() => {
      this.activeToast.set({ ...toast, isRemoving: true });
      this.appRef.tick();

      setTimeout(() => {
        this.activeToast.set(null);
        this.appRef.tick();
        this.showNext();
      }, 500);
    }, 1500);
  }
}

@Component({
  selector: 'app-toast-container',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule, IconComponent],
  host: {
    class: 'block',
  },
  styles: `
    .toast-item.toast-entering {
      animation: slideInDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .toast-item.toast-exiting {
      animation: slideOutUp 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @media (min-width: 768px) {
      .toast-item.toast-entering {
        animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .toast-item.toast-exiting {
        animation: slideOutLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      }
    }
    @keyframes slideInDown {
      from {
        opacity: 0;
        transform: translateY(-100%);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes slideOutUp {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(-100%);
      }
    }
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(-100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @keyframes slideOutLeft {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(-100%);
      }
    }
  `,
  template: `
    <div
      class="z-50 absolute w-full px-2 top-2 mx-auto md:w-72 md:left-4 md:top-auto md:bottom-4 md:px-0 flex flex-col items-center gap-[2px] pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      @if (toastService.currentToast(); as toast) {
        <div
          class="p-3 w-full bg-light dark:bg-dark text-ink dark:text-bone [&.error]:text-red-600 [&.error]:dark:text-red-400 font-display italic shadow-lg rounded-card flex gap-2 items-center border border-solid border-ink-200 pointer-events-auto transition-all duration-300 toast-item"
          [class.toast-entering]="!toast.isRemoving"
          [class.toast-exiting]="toast.isRemoving"
          [class.error]="toast.type === 'error'"
          role="alert"
        >
          <span class="w-5 h-5">
            @if (toast.type === 'success') {
              <app-icon name="check" />
            } @else if (toast.type === 'error') {
              <app-icon name="close" />
            } @else {
              <app-icon name="info" />
            }
          </span>
          <span>
            {{
              toast.count && toast.count > 1
                ? toast.pluralMessage || toast.message + ' (×' + toast.count + ')'
                : toast.message
            }}
          </span>
          @if (toast.action) {
            <button
              (click)="toast.action!.fn()"
              class="ml-auto text-sm font-bold underline hover:opacity-75 transition-opacity"
            >
              {{ toast.action.label }}
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  protected toastService = inject(ToastService);
}
