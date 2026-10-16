import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export type SearchEmptyStateVariant = 'idle' | 'empty';

@Component({
  selector: 'app-search-empty-state',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent],
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
      mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 16px,
        black 95%,
        transparent 100%
      );
    }
    .scroll-fade::-webkit-scrollbar {
      display: none;
    }
  `,
  template: `
    <div class="scroll-fade">
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