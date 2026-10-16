import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
  computed,
  inject,
} from '@angular/core';
import { IconComponent } from '../../shared/icons/icon.component';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <nav
      class="flex p-2 tab-bar-safe-bottom bg-light dark:bg-dark shadow-[0px_-4px_10px_5px_rgb(0_0_0/10%)] shrink-0 rounded-tl-xl rounded-tr-xl w-full"
    >
      <button
        class="flex items-center justify-center gap-3 border-none cursor-pointer font-body text-sm font-medium tracking-[0.04em] transition-colors duration-fast ease-smooth py-3 rounded-pill"
        [class]="
          activeTab === 'releases'
            ? 'bg-ink text-bone dark:bg-bone dark:text-ink'
            : 'bg-transparent text-ink-700 dark:text-bone-700'
        "
        [style.flex-grow]="activeTab === 'releases' ? 2 : 1"
        (click)="tabChange.emit('releases')"
      >
        <app-icon
          name="music-note"
          class="w-6 md:w-8 h-6 md:h-8"
        />
        @if (activeTab === 'releases') {
          <span class="font-display font-bold">{{ labels().releases }}</span>
        }
      </button>
      <button
        class="flex items-center justify-center gap-3 border-none cursor-pointer font-body text-sm font-medium tracking-[0.04em] transition-colors duration-fast ease-smooth py-3 rounded-pill"
        [class]="
          activeTab === 'search'
            ? 'bg-ink text-bone dark:bg-bone dark:text-ink'
            : 'bg-transparent text-ink-700 dark:text-bone-700'
        "
        [style.flex-grow]="activeTab === 'search' ? 2 : 1"
        (click)="tabChange.emit('search')"
      >
        <app-icon
          name="search"
          class="w-6 md:w-8 h-6 md:h-8"
        />
        @if (activeTab === 'search') {
          <span class="font-display font-bold">{{ labels().search }}</span>
        }
      </button>
      <button
        class="flex items-center justify-center gap-3 border-none cursor-pointer font-body text-sm font-medium tracking-[0.04em] transition-colors duration-fast ease-smooth py-3 rounded-pill"
        [class]="
          activeTab === 'wishlist'
            ? 'bg-ink text-bone dark:bg-bone dark:text-ink'
            : 'bg-transparent text-ink-700 dark:text-bone-700'
        "
        [style.flex-grow]="activeTab === 'wishlist' ? 2 : 1"
        (click)="tabChange.emit('wishlist')"
      >
        <app-icon
          name="heart"
          class="w-6 md:w-8 h-6 md:h-8"
        />
        @if (activeTab === 'wishlist') {
          <span class="font-display font-bold">{{ labels().wishlist }}</span>
        }
      </button>
    </nav>
  `,
})
export class TabBarComponent {
  private languageService = inject(LanguageService);

  @Input({ required: true }) activeTab: 'search' | 'wishlist' | 'releases' =
    'search';
  @Output() tabChange = new EventEmitter<'search' | 'wishlist' | 'releases'>();

  labels = computed(() => {
    const t = this.languageService.t();
    return {
      releases: t.releases.toUpperCase(),
      search: t.search.toUpperCase(),
      wishlist: t.wishlist.toUpperCase(),
    };
  });
}
