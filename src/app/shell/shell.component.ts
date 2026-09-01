import { Component, effect, inject, signal, computed } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';

import { filter, map } from 'rxjs';

import { HeaderComponent } from '../layout/header/header.component';
import { TabBarComponent } from '../layout/tab-bar/tab-bar.component';
import { SegmentedTabsComponent } from '../shared/components/segmented-tabs/segmented-tabs.component';
import { FloatingPlayerComponent } from '../shared/components/floating-player/floating-player.component';

import { SearchComponent } from '../features/search/search.component';
import { WishlistComponent } from '../features/wishlist/wishlist.component';
import { ReleasesComponent } from '../features/releases/releases.component';
import { LanguageService } from '../core/i18n/language.service';
import { PreviewService } from '../core/services/preview.service';

type Tab = 'releases' | 'search' | 'wishlist';

@Component({
  selector: 'app-shell',
  standalone: true,
  host: {
    class: 'block h-full overflow-hidden',
  },
  imports: [
    RouterOutlet,
    HeaderComponent,
    TabBarComponent,
    SegmentedTabsComponent,
    FloatingPlayerComponent,
    ReleasesComponent,
    SearchComponent,
    WishlistComponent,
  ],
  styles: `
    @keyframes panelEnter {
      from {
        opacity: 0;
        transform: translateX(10px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    .mobile-content > * {
      animation: panelEnter var(--dur-base) var(--ease);
    }
    .desktop-content::-webkit-scrollbar {
      width: 8px;
    }
    .desktop-content::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
    }
  `,
  template: `
    @if (isDesktop()) {
    <!-- DESKTOP -->
    <div class="bg-bone-300 dark:bg-ink flex flex-col h-full">
      <app-header class="z-10" (openProfile)="goToProfile()" />

      <main
        class="z-10 flex flex-1 overflow-hidden gap-16 p-3 w-full mx-auto min-[1400px]:mx-[10%] min-[1400px]:w-[calc(100%-20%)]"
      >
        <aside class="mt-60 w-[300px] flex flex-col items-start">
          <app-segmented-tabs
            [options]="navTabs()"
            [value]="activeTab()"
            variant="nav"
            (valueChange)="onNavTabChange($event)"
          />
        </aside>

        <section
          class="desktop-content flex-1 overflow-y-auto p-4 rounded-xl border border-bone-800 dark:border-ink-200 shadow-[0_2px_12px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_4px_rgba(0,0,0,0.15)] h-full [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10"
        >
          @if (hasChildRoute()) {
            <router-outlet />
          } @else {
            @switch (activeTab()) {
              @case ('releases') {
                <app-releases />
              }
              @case ('search') {
                <app-search />
              }
              @case ('wishlist') {
                <app-wishlist />
              }
            }
          }
        </section>
      </main>

      @if (hasActivePreview()) {
        <app-floating-player />
      }
    </div>

    } @else {
    <!-- MOBILE -->
    <div class="bg-bone-300 dark:bg-ink flex flex-col h-full">
      <app-header class="z-10" (openProfile)="goToProfile()" />

      <main
        class="z-10 mobile-content flex-1 overflow-hidden px-4"
        [class.has-preview]="hasActivePreview()"
      >
        @if (hasChildRoute()) {
          <router-outlet />
        } @else {
          @switch (activeTab()) {
            @case ('releases') {
              <app-releases />
            }
            @case ('search') {
              <app-search />
            }
            @case ('wishlist') {
              <app-wishlist />
            }
          }
        }
      </main>

      <app-tab-bar
        [activeTab]="activeTab()"
        (tabChange)="onTabChange($event)"
      />

      @if (hasActivePreview()) {
        <app-floating-player />
      }
    </div>
    }
  `,
})
export class ShellComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private languageService = inject(LanguageService);
  private previewService = inject(PreviewService);
  private breakpointObserver = inject(BreakpointObserver);

  isDesktop = toSignal(
    this.breakpointObserver
      .observe('(min-width: 1024px)')
      .pipe(map((r) => r.matches)),
    { initialValue: window.matchMedia('(min-width: 1024px)').matches },
  );

  activeTab = signal<Tab>(this.getDefaultTab());
  hasChildRoute = signal(false);

  t = computed(() => this.languageService.t());

  hasActivePreview = computed(
    () => this.previewService.state().metadata !== null,
  );

  navTabs = computed(() => [
    {
      value: 'releases' as const,
      label: this.t().releases.toUpperCase(),
      prefix: '01/',
    },
    {
      value: 'search' as const,
      label: this.t().search.toUpperCase(),
      prefix: '02/',
    },
    {
      value: 'wishlist' as const,
      label: this.t().wishlist.toUpperCase(),
      prefix: '03/',
    },
  ]);

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.hasChildRoute.set(!!this.route.firstChild);
      });

    effect(() => {
      this.activeTab();
      if (!this.hasChildRoute()) {
        this.router.navigate(['']);
      }
    });
  }

  private getDefaultTab(): Tab {
    const saved = localStorage.getItem('defaultTab') as Tab | null;
    return saved && ['releases', 'search', 'wishlist'].includes(saved)
      ? saved
      : 'search';
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  onNavTabChange(value: string) {
    this.activeTab.set(value as Tab);
    if (this.hasChildRoute()) {
      this.router.navigate(['']);
    }
  }

  onTabChange(value: Tab) {
    this.activeTab.set(value);
    if (this.hasChildRoute()) {
      this.router.navigate(['']);
    }
  }
}
