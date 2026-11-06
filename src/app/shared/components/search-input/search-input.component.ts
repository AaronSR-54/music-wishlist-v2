import {
  Component,
  ElementRef,
  input,
  output,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../icons/icon.component';

@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="group h-10 p-1 bg-bone dark:bg-ink-200 rounded-pill">
      <div
        class="flex h-full items-center gap-2.5 px-3 rounded-pill transition-colors duration-fast ease-smooth group-focus-within:bg-ink-200 dark:group-focus-within:bg-bone"
      >
        <app-icon
          name="search"
          class="text-ink-800 dark:text-bone-800 w-6 md:w-7 h-6 md:h-7 shrink-0 group-focus-within:text-bone dark:group-focus-within:text-ink"
        />
        <input
          #searchField
          id="search-input"
          type="text"
          [placeholder]="placeholder()"
          [ngModel]="query()"
          (ngModelChange)="onQuery($event)"
          class="min-w-0 flex-1 bg-transparent border-none outline-none text-ink dark:text-bone focus:text-bone dark:focus:text-ink font-display text-base md:text-lg font-normal placeholder:text-bone-800 dark:placeholder:text-ink-800 focus:placeholder:text-bone-600 dark:focus:placeholder:text-ink-600 placeholder:italic"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
        />
        @if (query()) {
          <button
            type="button"
            class="bg-transparent border-none cursor-pointer text-ink-600 dark:text-bone-600 p-[0.25em] flex items-center rounded-full transition-colors duration-fast ease-smooth text-sm md:text-lg hover:text-ink dark:hover:text-bone group-focus-within:text-bone dark:group-focus-within:text-ink"
            (click)="onClear()"
            [attr.aria-label]="clearLabel()"
          >
            <app-icon name="close" class="w-6 md:w-7 h-6 md:h-7" />
          </button>
        }
      </div>
    </div>
  `,
})
export class SearchInputComponent {
  @ViewChild('searchField') private searchField?: ElementRef<HTMLInputElement>;

  query = input.required<string>();
  placeholder = input('');
  clearLabel = input('Clear');

  queryChange = output<string>();
  clear = output<void>();

  focus(): void {
    this.searchField?.nativeElement.focus();
  }

  onQuery(value: string) {
    this.queryChange.emit(value);
  }

  onClear() {
    this.clear.emit();
  }
}
