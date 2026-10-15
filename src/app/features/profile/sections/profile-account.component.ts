import {
  Component,
  inject,
  signal,
  computed,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ProfileSectionComponent } from '../../../shared/components/profile-section/profile-section.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { LanguageService } from '../../../core/i18n/language.service';

@Component({
  selector: 'app-profile-account',
  standalone: true,
  imports: [ProfileSectionComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-profile-section [divider]="true">
      <div class="flex flex-col">
        <button
          (click)="logout()"
          class="w-full py-3 text-ink-700 dark:text-bone-700 font-display text-base font-semibold cursor-pointer transition-colors duration-base hover:text-ink-500 dark:hover:text-bone-500"
        >
          {{ t().closeSession }}
        </button>

        @if (!auth.demoMode()) {
          <button
            (click)="openDeleteModal()"
            class="w-full py-3 text-red-700 dark:text-red-400 font-display text-base font-semibold cursor-pointer transition-colors duration-base hover:opacity-80"
          >
            {{ t().deleteAccount }}
          </button>
        }
      </div>
    </app-profile-section>

    <app-modal
      #deleteModal
      [title]="t().deleteAccountTitle"
      (onClose)="closeDeleteModal()"
    >
      <div class="flex flex-col gap-5">
        <p class="m-0 text-sm leading-relaxed text-ink-600 dark:text-bone-600">
          {{ t().deleteAccountBody }}
        </p>
        <div class="flex gap-3">
          <button
            (click)="closeDeleteModal()"
            [disabled]="deleting()"
            class="flex-1 py-3 rounded-lg bg-bone dark:bg-ink-200 text-ink dark:text-bone font-bold uppercase cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {{ t().cancel }}
          </button>
          <button
            (click)="confirmDelete()"
            [disabled]="deleting()"
            class="flex-1 py-3 rounded-lg bg-red-600 text-bone font-bold uppercase cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {{ deleting() ? t().deletingAccount : t().deleteAccountConfirm }}
          </button>
        </div>
      </div>
    </app-modal>
  `,
})
export class ProfileAccountComponent {
  auth = inject(AuthService);
  private toast = inject(ToastService);
  private languageService = inject(LanguageService);

  @ViewChild('deleteModal', { static: true }) deleteModal!: ModalComponent;

  deleting = signal(false);

  t = computed(() => this.languageService.t());

  async logout() {
    await this.auth.logout();
  }

  openDeleteModal() {
    if (this.deleting()) return;
    this.deleteModal.open();
  }

  closeDeleteModal() {
    if (this.deleting()) return;
    this.deleteModal.close();
  }

  async confirmDelete() {
    if (this.deleting()) return;
    this.deleting.set(true);
    try {
      await this.auth.deleteAccount();
      // On success the app navigates to /login and this component is destroyed.
    } catch {
      this.toast.error(this.t().deleteAccountError);
      this.deleting.set(false);
      this.deleteModal.close();
    }
  }
}
