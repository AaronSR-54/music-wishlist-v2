import {
  Component,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { VersionService } from '../../core/version/version.service';
import { IconComponent } from '../../shared/icons/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  styles: `
    @keyframes dot-pulse {
      0%,
      80%,
      100% {
        opacity: 0.3;
        transform: scale(0.9);
      }
      40% {
        opacity: 1;
        transform: scale(1.1);
      }
    }
    .dot-pulse {
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: center;
    }
    .dot-pulse span {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      animation: dot-pulse 1.4s ease-in-out infinite;
    }
    .dot-pulse span:nth-child(2) {
      animation-delay: 0.2s;
    }
    .dot-pulse span:nth-child(3) {
      animation-delay: 0.4s;
    }
  `,
  template: `
    <div
      class="min-h-dvh bg-bone-300 dark:bg-ink flex flex-col p-8 min-[600px]:px-24 mx-auto overflow-hidden
            relative 
            before:content-['']
            before:absolute
            before:-top-32
            before:-right-32
            before:w-96
            before:h-96
            before:rounded-full
            before:pointer-events-none
            before:dark:bg-[radial-gradient(circle,_theme(colors.ink.400)_0%,_transparent_70%)]
            before:bg-[radial-gradient(circle,_theme(colors.bone.400)_0%,_transparent_70%)]"
    >
      <header
        class="flex justify-between items-center pb-6 z-10"
        style="animation: slideDown 600ms cubic-bezier(0.16,1,0.3,1) both"
      >
        <span
          class="font-display text-[12px] text-ink dark:text-bone font-bold tracking-[0.06em] uppercase"
        >
          <span class="text-ink-700 dark:text-bone-700 font-normal italic"
            >00/</span
          >
          ACCESO
        </span>
        <span
          class="text-ink-100 dark:text-bone-800 text-[11px] italic font-medium font-mono"
          >v{{ version() }}</span
        >
      </header>

      <main class="flex-1 flex flex-col justify-center gap-5 py-12">
        <h1
          class="font-display text-[68px] md:text-[88px] font-bold leading-[0.8] m-0 tracking-[-0.03em] text-ink dark:text-bone"
          style="animation: titleEntrance 800ms cubic-bezier(0.16,1,0.3,1) both; animation-delay: 80ms"
        >
          Music <span class="font-extralight italic ml-[-7px]">Wishlist</span>.
        </h1>
        <p
          class="font-body text-sm leading-[1.2] text-ink-600 dark:text-bone-600 m-0"
          style="animation: driftUp 700ms cubic-bezier(0.16,1,0.3,1) both; animation-delay: 200ms"
        >
          {{ t().loginTagline }}
        </p>
      </main>

      <footer
        class="flex flex-col gap-4 pt-6"
        style="animation: slideUp 650ms cubic-bezier(0.16,1,0.3,1) both; animation-delay: 280ms"
      >
        <span
          class="font-body text-[12px] font-medium text-ink-700 dark:text-bone-700"
          >{{ t().loginWith }}</span
        >

        <div class="flex gap-4 flex-wrap items-end">
          <button
            class="inline-flex items-center justify-center gap-[10px] py-[14px] px-6 rounded-pill bg-ink dark:bg-bone text-bone dark:text-ink font-body text-[15px] font-semibold border-none cursor-pointer transition-[opacity,transform] duration-fast ease-smooth self-start min-w-[220px] min-h-12 max-[480px]:w-full hover:opacity-[0.88] hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            (click)="login()"
            [disabled]="loading()"
          >
            @if (loading()) {
              <span class="dot-pulse">
                <span></span><span></span><span></span>
              </span>
            } @else {
              <app-icon
                name="google"
                class="w-[1.125rem] md:w-[1.375rem] h-[1.125rem] md:h-[1.375rem] fill-bone dark:fill-ink"
              />
              {{ t().continueWithGoogle }}
            }
          </button>
        </div>
        @if (error()) {
          <p class="text-[13px] text-[#e57373] m-0">{{ error() }}</p>
        }
      </footer>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private languageService = inject(LanguageService);
  versionService = inject(VersionService);

  loading = signal(false);
  error = signal('');
  version = this.versionService.version;

  t = computed(() => this.languageService.t());

  async login() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.loginWithGoogle();
    } catch (e: unknown) {
      this.error.set(this.languageService.t().loginError);
    } finally {
      this.loading.set(false);
    }
  }
}
