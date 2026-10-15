import {
  Component,
  EventEmitter,
  Output,
  inject,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent],
  template: `
    <header
      class="flex items-center justify-between h-16 px-6 shrink-0 gap-4 max-md:h-14 max-md:px-4"
    >
      <h1
        class="font-display text-2xl md:text-[1.75rem] font-bold leading-[0.8] m-0 tracking-[-0.03em] text-ink dark:text-bone"
      >
        Music <span class="font-light italic">Wishlist</span>.
      </h1>

      <div class="min-w-40 flex justify-end items-center gap-3 max-md:min-w-0">
        @if (user(); as u) {
          <button
            class="bg-transparent border-none cursor-pointer p-0 rounded-full transition-opacity duration-fast ease-smooth hover:opacity-80"
            (click)="openProfile.emit()"
            [title]="t().openProfile"
          >
            <app-avatar [name]="u.displayName ?? u.email ?? 'U'" [size]="34" />
          </button>
        }
      </div>
    </header>
  `,
})
export class HeaderComponent {
  @Output() openProfile = new EventEmitter<void>();

  private auth = inject(AuthService);
  private languageService = inject(LanguageService);

  user = this.auth.currentUser;
  t = computed(() => this.languageService.t());
}
