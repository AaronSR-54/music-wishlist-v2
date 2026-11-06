import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ScrollMaskDirective } from '../../directives/scroll-mask.directive';

export type SearchEmptyStateVariant = 'idle' | 'empty';

@Component({
  selector: 'app-search-empty-state',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, ScrollMaskDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .scroll-fade {
      flex: 1;
      overflow-y: auto;
      scrollbar-width: none;
      padding: 4px 0 2rem;
    }
    .scroll-fade::-webkit-scrollbar {
      display: none;
    }
  `,
  template: `
    <div class="scroll-fade" appScrollMask>
      @switch (variant()) {
        @case ('idle') {
          <app-empty-state
            icon="search"
            [title]="title()"
            [subtitle]="subtitle()"
          />
        }
        @case ('empty') {
          <app-empty-state
            [icon]="null"
            [title]="title()"
            [subtitle]="subtitle()"
          />
        }
      }
    </div>
  `,
})
export class SearchEmptyStateComponent {
  variant = input.required<SearchEmptyStateVariant>();
  title = input('');
  subtitle = input('');
}
