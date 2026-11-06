import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SegmentedTabOption<T extends string = string> {
  value: T;
  label: string;
  prefix?: string;
  suffix?: string;
  title?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-segmented-tabs',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- nav variant: editorial style with prefixes -->
    @if (variant() === 'nav') {
      <div class="flex flex-col">
        @for (option of options(); track option.value) {
          <button
            class="inline-flex gap-2 text-ink-700 dark:text-bone-700 text-[28px] font-light italic font-display cursor-pointer uppercase border-none bg-transparent p-0 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-80"
            [style.transform]="value() === option.value ? 'translateX(4px)' : 'translateX(0)'"
            [class.active]="value() === option.value"
            (click)="valueChange.emit(option.value)"
          >
            @if (option.prefix) {
              <span
                class="w-14 text-right transition-[opacity,color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                [class.opacity-0]="value() !== option.value"
                >{{ option.prefix }}</span
              >
            }
            <span
              class="shrink transition-[color,font-weight] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] [&.active]:text-ink [&.active]:dark:text-bone [&.active]:font-bold [&.active]:not-italic"
              [class.active]="value() === option.value"
              >{{ option.label }}</span
            >
          </button>
        }
      </div>
    }

    <!-- toggle variant: compact pill style -->
    @if (variant() === 'toggle') {
      <div
        class="p-1 bg-bone dark:bg-ink-200 rounded-pill md:flex-1"
        [class.w-full]="activeWide()"
      >
        <div class="flex flex-row gap-1 rounded-pill overflow-hidden">
          @for (option of options(); track option.value) {
            <button
              class="flex-1 py-1 font-body uppercase text-ink-200 dark:text-bone-600 rounded-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] [&.active]:bg-ink-200 [&.active]:dark:bg-bone [&.active]:text-bone  [&.active]:dark:text-ink [&.active]:font-bold italic [&.active]:not-italic"
              [class.active]="value() === option.value"
              [style.flex-grow]="activeWide() && value() === option.value ? 2 : 1"
              [class.opacity-40]="option.disabled"
              [class.cursor-not-allowed]="option.disabled"
              [disabled]="option.disabled ?? false"
              [title]="option.title ?? option.label"
              (click)="valueChange.emit(option.value)"
            >
              <span class="whitespace-nowrap">{{ option.label }}</span>
              @if (option.suffix) {
                <span class="whitespace-nowrap font-light italic">{{ option.suffix }}</span>
              }
            </button>
          }
        </div>
      </div>
    }

    @if (variant() === 'list') {
      <div class="rounded-lg p-1 bg-bone dark:bg-ink-200">
        <div class="flex flex-col gap-1 rounded-lg overflow-hidden">
          @for (option of options(); track option.value) {
            <button
              class="flex-1 py-3 font-body uppercase italic text-ink-200 dark:text-bone-600 rounded-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-70 [&.active]:bg-ink-200 [&.active]:dark:bg-bone-200 [&.active]:text-bone  [&.active]:dark:text-ink [&.active]:font-bold [&.active]:not-italic"
              [class.active]="value() === option.value"
              [disabled]="option.disabled ?? false"
              [title]="option.title ?? option.label"
              (click)="valueChange.emit(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class SegmentedTabsComponent<T extends string = string> {
  options = input.required<SegmentedTabOption<T>[]>();
  value = input.required<T>();
  variant = input<'nav' | 'toggle' | 'list'>('toggle');
  activeWide = input(false);

  valueChange = output<T>();
}
