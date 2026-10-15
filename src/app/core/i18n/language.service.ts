import { Injectable, signal, computed, inject } from '@angular/core';
import { translations, TranslationKey } from './translations';
import { ToastService } from '../../shared/components/toast/toast.component';

export type Language = 'es' | 'en';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private language = signal<Language>(this.getSavedLanguage());
  private toastService = inject(ToastService);

  t = computed(() => translations[this.language()]);

  constructor() {
    this.applyDocumentLanguage();
  }

  getLanguage(): Language {
    return this.language();
  }

  setLanguage(lang: Language) {
    this.language.set(lang);
    localStorage.setItem('app-language', lang);
    this.applyDocumentLanguage();
    this.toastService.success('Preferencias guardadas');
  }

  private getSavedLanguage(): Language {
    const saved = localStorage.getItem('app-language') as Language | null;
    if (saved && ['es', 'en'].includes(saved)) {
      return saved;
    }
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'es') {
      return 'es';
    }
    return 'en';
  }

  private applyDocumentLanguage() {
    document.documentElement.lang = this.language();
  }
}