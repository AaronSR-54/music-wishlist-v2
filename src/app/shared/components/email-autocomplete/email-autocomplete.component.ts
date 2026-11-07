import {
  Component,
  output,
  input,
  signal,
  computed,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../icons/icon.component';
import { LanguageService } from '../../../core/i18n/language.service';

@Component({
  selector: 'app-email-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full">
      <div
        class="w-100 flex items-center gap-2 py-4 border-b border-solid border-bone-600 dark:border-bone-800 group hover:border-bone-800 dark:hover:border-bone-600 transition-colors duration-base"
      >
        <app-icon
          name="mail"
          class="text-ink-800 dark:text-bone-800 w-8 h-8 group-hover:text-ink-700 dark:group-hover:text-bone-700 transition-colors duration-base"
        />
        <input
          type="email"
          [placeholder]="t().emailPlaceholder"
          [(ngModel)]="emailInput"
          (keyup.enter)="selectEmail(emailInput())"
          [disabled]="disabled()"
          class="w-full px-2 rounded-sm bg-transparent text-ink dark:text-bone font-body text-lg placeholder:text-bone-800 dark:placeholder:text-bone-700 placeholder:italic transition-colors duration-base border-none outline-none"
        />
        <button
          (click)="selectEmail(emailInput())"
          [disabled]="!emailValid()"
          class="fill-ink-600 dark:fill-bone-600 hover:fill-bone transition-colors duration-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          [title]="t().share"
        >
          <app-icon name="send" class="w-6 h-6" />
        </button>
      </div>
    </div>
  `,
})
export class EmailAutocompleteComponent {
  disabled = input<boolean>(false);
  emailSelected = output<string>();
  private languageService = inject(LanguageService);

  t = computed(() => this.languageService.t());

  emailInput = signal('');

  emailValid = computed(() => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(this.emailInput().trim());
  });

  selectEmail(email: string): void {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email.trim())) return;
    this.emailSelected.emit(email.trim());
    this.emailInput.set('');
  }
}
