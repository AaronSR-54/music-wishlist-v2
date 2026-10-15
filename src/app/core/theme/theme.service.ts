import { Injectable, computed, effect, signal, inject } from '@angular/core';
import { ToastService } from '../../shared/components/toast/toast.component';

type Theme = 'light' | 'dark' | 'system';

const THEME_COLORS = {
  light: '#e5e0d8',
  dark: '#22201f',
} as const;

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private theme = signal<Theme>(this.getSavedTheme());
  private systemPrefersDark = signal(this.getSystemPreference());
  private toastService = inject(ToastService);

  isDarkMode = computed(() => {
    const theme = this.theme();
    if (theme === 'system') {
      return this.systemPrefersDark();
    }
    return theme === 'dark';
  });

  constructor() {
    this.initSystemThemeListener();
    effect(() => {
      this.isDarkMode();
      this.updateTheme();
    });
  }

  private getSystemPreference(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private initSystemThemeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      this.systemPrefersDark.set(e.matches);
    });
  }

  setTheme(theme: Theme) {
    this.theme.set(theme);
    localStorage.setItem('app-theme', theme);
    this.toastService.success('Preferencias guardadas');
  }

  getTheme(): Theme {
    return this.theme();
  }

  toggleTheme() {
    const current = this.theme();
    const next = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  private getSavedTheme(): Theme {
    const saved = localStorage.getItem('app-theme') as Theme | null;
    return saved && ['light', 'dark', 'system'].includes(saved)
      ? saved
      : 'system';
  }

  private updateTheme() {
    const isDark = this.isDarkMode();

    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
      html.removeAttribute('data-theme');
    } else {
      html.classList.remove('dark');
      html.setAttribute('data-theme', 'light');
    }
    html.style.colorScheme = isDark ? 'dark' : 'light';

    const color = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  }
}
