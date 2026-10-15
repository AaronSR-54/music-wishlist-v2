import {
  Component,
  signal,
  ChangeDetectionStrategy,
  computed,
  inject,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileSectionComponent } from '../../../shared/components/profile-section/profile-section.component';
import { SegmentedTabsComponent } from '../../../shared/components/segmented-tabs/segmented-tabs.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ThemeService } from '../../../core/theme/theme.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { ToastService } from '../../../shared/components/toast/toast.component';

type TabType = 'releases' | 'search' | 'wishlist';
type Theme = 'light' | 'dark' | 'system';
type Language = 'es' | 'en';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [
    CommonModule,
    ProfileSectionComponent,
    SegmentedTabsComponent,
    ModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-profile-section [title]="t().settings">
      <section
        class="border border-solid border-bone-800 dark:border-ink-200 rounded-lg p-4 flex flex-col gap-8"
      >
        <div class="flex flex-col md:flex-row gap-2 md:items-center">
          <span class="md:min-w-36 italic text-ink-700 dark:text-bone-700">
            {{ t().defaultPage }}:
          </span>

          <button
            class="md:hidden w-full px-4 py-2 rounded-lg bg-bone dark:bg-ink-200 dark:text-bone font-bold uppercase"
            (click)="openTabModal()"
          >
            {{ tabOptionLabel() }}
          </button>

          <app-segmented-tabs
            class="hidden md:flex flex-1"
            variant="toggle"
            [options]="tabOptions()"
            [value]="defaultTab()"
            (valueChange)="setDefaultTab($event)"
          />
        </div>

        <div class="flex flex-col md:flex-row gap-2 md:items-center">
          <span class="md:min-w-36 italic text-ink-700 dark:text-bone-700">
            {{ t().theme }}:
          </span>

          <button
            class="md:hidden w-full px-4 py-2 rounded-lg bg-bone dark:bg-ink-200 dark:text-bone font-bold uppercase"
            (click)="openThemeModal()"
          >
            {{ themeOptionLabel() }}
          </button>

          <app-segmented-tabs
            class="hidden md:flex flex-1"
            variant="toggle"
            [options]="themeOptions()"
            [value]="currentTheme()"
            (valueChange)="setTheme($event)"
          />
        </div>

        <div class="flex flex-col md:flex-row gap-2 md:items-center">
          <span class="md:min-w-36 italic text-ink-700 dark:text-bone-700">
            {{ t().language }}:
          </span>

          <button
            class="md:hidden w-full px-4 py-2 rounded-lg bg-bone dark:bg-ink-200 dark:text-bone font-bold uppercase"
            (click)="openLangModal()"
          >
            {{ langOptionLabel() }}
          </button>

          <app-segmented-tabs
            class="hidden md:flex flex-1"
            variant="toggle"
            [options]="langOptions()"
            [value]="currentLanguage()"
            (valueChange)="setLanguage($event)"
          />
        </div>

        <div class="flex flex-col md:flex-row gap-2 md:items-center">
          <span class="md:min-w-36 italic text-ink-700 dark:text-bone-700">
            {{ t().notifications }}:
          </span>

          @if (!pushSvc.isSupported()) {
            <span class="text-sm text-ink-600 dark:text-bone-600 italic">
              {{ t().notificationsNotSupported }}
            </span>
          } @else if (notificationsBlocked()) {
            <span class="text-sm text-ink-600 dark:text-bone-600 italic">
              {{ t().notificationsBlocked }}
            </span>
          } @else {
            <div class="flex-1 flex flex-col gap-2">
              <span class="text-sm text-ink-600 dark:text-bone-600 italic">
                {{ notificationsStatus() }}
              </span>

              <div class="flex flex-col sm:flex-row gap-2">
                <button
                  class="flex-1 px-4 py-2 rounded-lg font-bold uppercase transition-all duration-300"
                  [class]="pushSvc.isSubscribed()
                    ? 'bg-accent text-bone dark:bg-accent dark:text-bone shadow-sm'
                    : 'bg-bone dark:bg-ink-200 dark:text-bone border-2 border-bone-800 dark:border-ink-300 hover:bg-bone-700 dark:hover:bg-ink-300'"
                  [disabled]="pushSvc.loading()"
                  (click)="toggleNotifications()"
                >
                  {{ pushSvc.isSubscribed() ? t().disableNotifications : t().enableNotifications }}
                </button>

                @if (pushSvc.isSubscribed()) {
                  <button
                    class="flex-1 px-4 py-2 rounded-lg font-bold uppercase bg-bone dark:bg-ink-200 dark:text-bone border-2 border-bone-800 dark:border-ink-300 hover:bg-bone-700 dark:hover:bg-ink-300 transition-all duration-300"
                    [disabled]="testing()"
                    (click)="sendTestNotification()"
                  >
                    {{ t().sendTestNotification }}
                  </button>
                }
              </div>
            </div>
          }
        </div>

      </section>

      <app-modal #tabModal [title]="t().defaultPage" (onClose)="closeTabModal()">
        <app-segmented-tabs
          variant="list"
          [options]="tabOptions()"
          [value]="defaultTab()"
          (valueChange)="onTabChange($event)"
        />
      </app-modal>

      <app-modal #themeModal [title]="t().theme" (onClose)="closeThemeModal()">
        <app-segmented-tabs
          variant="list"
          [options]="themeOptions()"
          [value]="currentTheme()"
          (valueChange)="onThemeChange($event)"
        />
      </app-modal>

      <app-modal #langModal [title]="t().language" (onClose)="closeLangModal()">
        <app-segmented-tabs
          variant="list"
          [options]="langOptions()"
          [value]="currentLanguage()"
          (valueChange)="onLangChange($event)"
        />
      </app-modal>
    </app-profile-section>
  `,
})
export class ProfileSettingsComponent {
  private themeService = inject(ThemeService);
  private languageService = inject(LanguageService);
  pushSvc = inject(PushNotificationService);
  private toast = inject(ToastService);

  @ViewChild('tabModal', { static: true }) tabModal!: ModalComponent;
  @ViewChild('themeModal', { static: true }) themeModal!: ModalComponent;
  @ViewChild('langModal', { static: true }) langModal!: ModalComponent;

  defaultTab = signal<TabType>('releases');
  currentTheme = signal<Theme>('system');
  currentLanguage = signal<Language>('es');

  t = computed(() => this.languageService.t());

  testing = signal(false);

  notificationsBlocked = computed(
    () =>
      this.pushSvc.isSupported() &&
      this.pushSvc.permissionState() === 'denied'
  );

  notificationsStatus = computed(() => {
    if (!this.pushSvc.isSupported()) return this.t().notificationsNotSupported;
    if (this.pushSvc.permissionState() === 'denied')
      return this.t().notificationsBlocked;
    return this.pushSvc.isSubscribed()
      ? this.t().notificationsActive
      : this.t().notificationsInactive;
  });

  tabOptions = computed(() => [
    { value: 'releases' as const, label: this.t().releases },
    { value: 'search' as const, label: this.t().search },
    { value: 'wishlist' as const, label: this.t().wishlist },
  ]);

  themeOptions = computed(() => [
    { value: 'system' as const, label: this.t().system },
    { value: 'light' as const, label: this.t().light },
    { value: 'dark' as const, label: this.t().dark },
  ]);

  langOptions = signal([
    { value: 'es' as const, label: 'Español' },
    { value: 'en' as const, label: 'English' },
  ]);

  tabOptionLabel = computed(
    () =>
      this.tabOptions().find((o) => o.value === this.defaultTab())?.label ??
      this.t().select,
  );

  themeOptionLabel = computed(
    () =>
      this.themeOptions().find((o) => o.value === this.currentTheme())?.label ??
      this.t().select,
  );

  langOptionLabel = computed(
    () =>
      this.langOptions().find((o) => o.value === this.currentLanguage())?.label ??
      this.t().select,
  );

  constructor() {
    const saved = localStorage.getItem('defaultTab') as TabType | null;
    if (saved) this.defaultTab.set(saved);

    this.currentTheme.set(this.themeService.getTheme());
    this.currentLanguage.set(this.languageService.getLanguage());
  }

  openTabModal() {
    this.tabModal.open();
  }

  closeTabModal() {
    this.tabModal.close();
  }

  openThemeModal() {
    this.themeModal.open();
  }

  closeThemeModal() {
    this.themeModal.close();
  }

  openLangModal() {
    this.langModal.open();
  }

  closeLangModal() {
    this.langModal.close();
  }

  setDefaultTab(tab: TabType) {
    this.defaultTab.set(tab);
    localStorage.setItem('defaultTab', tab);
  }

  setTheme(theme: Theme) {
    this.currentTheme.set(theme);
    this.themeService.setTheme(theme);
  }

  setLanguage(lang: Language) {
    this.currentLanguage.set(lang);
    this.languageService.setLanguage(lang);
  }

  onTabChange(value: string) {
    this.setDefaultTab(value as TabType);
    this.closeTabModal();
  }

  onThemeChange(value: string) {
    this.setTheme(value as Theme);
    this.closeThemeModal();
  }

  onLangChange(value: string) {
    this.setLanguage(value as Language);
    this.closeLangModal();
  }

  async toggleNotifications() {
    if (this.pushSvc.isSubscribed()) {
      await this.pushSvc.unsubscribe();
      this.toast.success(this.t().toastNotificationsDisabled);
    } else {
      const result = await this.pushSvc.subscribe();
      if (result === 'granted') {
        this.toast.success(this.t().toastNotificationsEnabled);
      } else if (result === 'denied') {
        this.toast.error(this.t().toastNotificationsDenied);
      } else {
        const detail = this.pushSvc.lastError();
        this.toast.error(
          detail
            ? `${this.t().toastNotificationsError} (${detail})`
            : this.t().toastError,
        );
      }
    }
  }

  async sendTestNotification() {
    this.testing.set(true);
    try {
      const ok = await this.pushSvc.sendTest();
      this.toast[ok ? 'success' : 'error'](
        ok ? this.t().toastNotificationTestSent : this.t().toastNotificationTestFailed,
      );
    } finally {
      this.testing.set(false);
    }
  }

}
