import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { ProfileAccountComponent } from './sections/profile-account.component';
import { ProfileStatsComponent } from './sections/profile-stats.component';
import { ProfileSharedComponent } from './sections/profile-shared.component';
import { ProfileSettingsComponent } from './sections/profile-settings.component';
import { LanguageService } from '../../core/i18n/language.service';
import { VersionService } from '../../core/version/version.service';
import { SuperuserService } from '../../core/superuser/superuser.service';
import { ToastService } from '../../shared/components/toast/toast.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    AvatarComponent,
    ProfileAccountComponent,
    ProfileStatsComponent,
    ProfileSharedComponent,
    ProfileSettingsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* Header: aparece con calma desde arriba */
    .profile-header {
      animation: slideDown 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    /* Hero: deriva suave — personal y tranquilo */
    .profile-hero {
      animation: driftUp 800ms cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: 60ms;
    }
    /* Secciones: deriva lenta, escalonada */
    .profile-section {
      animation: driftUp 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
  `,
  template: `
    <div
      class="flex flex-col h-full overflow-hidden gap-4 bg-bone-300 dark:bg-ink"
    >
      <div
        class="flex items-center justify-between h-16 px-6 shrink-0 gap-4 max-md:h-14 max-md:px-4 profile-header"
      >
        <button
          class="bg-transparent text-ink-700 dark:text-bone-700 text-md cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-ink dark:hover:text-bone hover:scale-105 active:scale-95 lowercase"
          (click)="goBack()"
          [aria-label]="t().back"
        >
          ← {{ t().back }}
        </button>

        <span
          class="font-display text-md text-ink dark:text-bone font-bold tracking-[0.06em] uppercase"
        >
          <span class="text-ink-700 dark:text-bone-700 font-normal italic"
            >04/</span
          >
          {{ t().profile }}
        </span>
      </div>

      @if (auth.currentUser(); as user) {
        <div
          class="py-8 px-4 md:p-8 min-h-full w-full max-w-7xl gap-8 flex flex-col justify-between mx-auto overflow-auto [scrollbar-width:none]"
        >
          <section class="flex flex-col gap-12">
            <!-- HERO -->
            <div class="flex gap-4 mb-6 px-2 profile-hero">
              <app-avatar
                [name]="user.displayName ?? user.email ?? 'Usuario'"
                [size]="80"
              />

              <div class="flex flex-col justify-center gap-2">
                <h1
                  class="font-display text-xl font-bold text-ink dark:text-bone leading-tight m-0"
                >
                  {{ user.displayName ?? user.email }}
                </h1>

                <p class="text-sm text-ink-600 dark:text-bone-600 m-0">
                  {{ user.email }}
                </p>

                <p class="text-sm text-ink-600 dark:text-bone-600 m-0">
                  {{ user.id }}
                </p>
              </div>
            </div>

            <!-- SECTIONS -->
            <app-profile-stats
              class="profile-section"
              style="animation-delay: 100ms"
            />
            <app-profile-shared
              class="profile-section"
              style="animation-delay: 200ms"
            />
            <app-profile-settings
              class="profile-section"
              style="animation-delay: 300ms"
            />
          </section>

          <div
            class="profile-section flex flex-col items-center gap-6 w-full pb-16 md:pb-20"
            style="animation-delay: 400ms"
          >
            <!-- ACCOUNT -->
            <app-profile-account />
            <span
              class="text-ink-100 dark:text-bone-800 text-[11px] italic font-medium font-mono cursor-pointer select-none active:scale-95 transition-transform"
              (click)="onVersionTap()"
            >
              v{{ versionService.version() }}
            </span>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProfileComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  private languageService = inject(LanguageService);
  versionService = inject(VersionService);
  private superuser = inject(SuperuserService);
  private toast = inject(ToastService);

  t = computed(() => this.languageService.t());

  goBack() {
    this.router.navigate(['/']);
  }

  onVersionTap(): void {
    const result = this.superuser.handleVersionTap();
    if (result === 'enabled') {
      this.toast.success(this.t().superuserEnabled);
    } else if (result === 'disabled') {
      this.toast.success(this.t().superuserDisabled);
    }
  }
}
