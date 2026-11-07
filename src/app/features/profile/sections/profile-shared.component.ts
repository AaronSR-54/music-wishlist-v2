import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { WishlistShareService } from '../../../core/firebase/wishlist-share.service';
import { WishlistShare } from '../../../shared/models/wishlist-share.model';
import { IconComponent } from '../../../shared/icons/icon.component';
import { ProfileSectionComponent } from '../../../shared/components/profile-section/profile-section.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { EmailAutocompleteComponent } from '../../../shared/components/email-autocomplete/email-autocomplete.component';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-profile-shared',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ProfileSectionComponent,
    EmptyStateComponent,
    EmailAutocompleteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-profile-section [title]="t().social">
      <section
        class="flex flex-col gap-8 border border-solid border-bone-800 dark:border-ink-200 rounded-lg p-4 shadow-[0_2px_12px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_4px_rgba(0,0,0,0.15)]"
      >
        <!-- SECCIÓN: Compartida con -->
        <div class="flex flex-col gap-4">
          <h3
            class="text-sm md:text-lg text-ink-700 dark:text-bone-700 italic"
          >
            {{ t().shareWith }}
          </h3>

          <!-- Input de email autocomplete -->
          <app-email-autocomplete
            class="block md:max-w-md"
            (emailSelected)="shareWith($event)"
            [disabled]="loading()"
          />

          <!-- Listado de shares enviados -->
          <div class="flex flex-col gap-3">
            @for (share of shareService.sharesGiven(); track share.id) {
              <div
                class="flex items-center justify-between py-3 px-2 group hover:bg-bone-100/50 hover:dark:bg-ink-100/20 rounded transition-colors duration-base"
              >
                <span class="text-ink dark:text-bone text-sm font-medium">
                  {{ share.recipientEmail }}
                </span>
                <button
                  (click)="unshare(share)"
                  [disabled]="loading()"
                  class="text-ink-400 dark:text-bone-600 hover:text-ink hover:dark:text-bone transition-colors duration-base cursor-pointer md:opacity-0 md:group-hover:opacity-100"
                  [title]="t().remove"
                >
                  <app-icon name="close" class="w-5 h-5" />
                </button>
              </div>
            } @empty {
              <app-empty-state
                icon="heart"
                [title]="t().notSharedYet"
                [subtitle]="t().shareSubtitle"
              />
            }
          </div>
        </div>

        <!-- SECCIÓN: De otros usuarios -->
        @if (shareService.sharesReceived().length > 0) {
          <div class="flex flex-col gap-4">
            <h3
              class="text-sm md:text-lg text-ink-700 dark:text-bone-700 italic "
            >
              {{ t().otherUsersWishlists }}
            </h3>

            <div class="flex flex-col gap-3">
              @for (share of shareService.sharesReceived(); track share.id) {
                <div
                  class="flex items-center justify-between py-3 px-2 group transition-all duration-base"
                  [class.opacity-50]="share.hidden"
                >
                  <div class="flex flex-col gap-1 min-w-0">
                    <span
                      class="text-ink dark:text-bone text-sm font-semibold truncate"
                    >
                      {{ share.ownerName }}
                    </span>
                    <span class="text-ink-600 dark:text-bone-600 text-xs">
                      {{ share.ownerUid }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      (click)="toggleHidden(share)"
                      [disabled]="loading()"
                      class="text-xs fill-ink-600 dark:fill-bone-600 transition-colors duration-base cursor-pointer"
                      [title]="share.hidden ? 'Mostrar' : 'Ocultar'"
                    >
                      <app-icon
                        [name]="share.hidden ? 'eye-off' : 'eye'"
                        class="w-6 h-6"
                      />
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </section>
    </app-profile-section>
  `,
})
export class ProfileSharedComponent {
  private auth = inject(AuthService);
  shareService = inject(WishlistShareService);
  private languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  loading = signal(false);

  t = computed(() => this.languageService.t());

  async shareWith(email: string): Promise<void> {
    if (this.loading()) return;

    this.loading.set(true);
    try {
      const user = this.auth.currentUser();
      if (!user) return;

      await this.shareService.share(
        email,
        user.uid,
        user.displayName || user.email || 'Usuario',
        user.photoURL || null,
      );
      this.toastService.success(this.t().toastWishlistShared);
    } catch {
      this.toastService.error(this.t().toastError);
    } finally {
      this.loading.set(false);
    }
  }

  async unshare(share: WishlistShare): Promise<void> {
    if (this.loading()) return;

    this.loading.set(true);
    try {
      const user = this.auth.currentUser();
      if (!user) return;

      await this.shareService.unshare(share.id!, user.uid);
      this.toastService.success(this.t().toastWishlistUnshared);
    } catch {
      this.toastService.error(this.t().toastError);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleHidden(share: WishlistShare): Promise<void> {
    if (this.loading()) return;

    this.loading.set(true);
    try {
      await this.shareService.toggleHidden(share);
      this.toastService.success(
        share.hidden ? this.t().toastSharedVisible : this.t().toastSharedHidden,
      );
    } catch {
      this.toastService.error(this.t().toastError);
    } finally {
      this.loading.set(false);
    }
  }
}
