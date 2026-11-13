import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TypeChipComponent } from '../type-chip/type-chip.component';
import { TrackType } from '../../models/track.model';
import { CatalogSearchFilter } from '../../models/catalog-provider';

export type FilterType = CatalogSearchFilter;

export interface TypeFilterOption<T extends string = FilterType> {
  value: T;
  label: string;
}

@Component({
  selector: 'app-type-filter',
  standalone: true,
  imports: [CommonModule, TypeChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* Icon-only chips keep an even width; the selected one grows to fit its label. */
    @media (max-width: 767px) {
      .chip-button.is-selected {
        flex: 0 0 auto;
      }
    }
  `,
  template: `
    <div
      class="flex w-full gap-2 overflow-x-auto px-2 md:max-w-[480px] [animation:slideDown_200ms_var(--ease)_both]"
    >
        @for (option of options(); track option.value) {
          <button
            type="button"
            class="chip-button inline-flex min-h-11 min-w-0 flex-1 items-center justify-center cursor-pointer rounded-md border-0 bg-transparent p-0 transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            [class.is-selected]="selectedTypes().has(option.value)"
            [attr.aria-pressed]="selectedTypes().has(option.value)"
            [attr.aria-label]="option.label"
            (click)="onToggle(option.value)"
          >
            <app-type-chip
              [type]="option.value"
              [labelOverride]="option.label"
              size="filter"
              [solid]="selectedTypes().has(option.value)"
            />
          </button>
        }
    </div>
  `,
})
export class TypeFilterComponent<T extends FilterType = FilterType> {
  selectedTypes = input.required<ReadonlySet<TrackType>>();
  options = input.required<TypeFilterOption<T>[]>();

  toggle = output<T>();

  onToggle(type: T) {
    this.toggle.emit(type);
  }
}
