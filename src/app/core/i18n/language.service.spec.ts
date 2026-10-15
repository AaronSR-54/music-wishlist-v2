import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';
import { ToastService } from '../../shared/components/toast/toast.component';

function setNavigatorLanguage(lang: string) {
  Object.defineProperty(window.navigator, 'language', {
    value: lang,
    configurable: true,
  });
}

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    TestBed.configureTestingModule({});
    spyOn(TestBed.inject(ToastService), 'success');
  });

  it('uses the saved preference when present', () => {
    localStorage.setItem('app-language', 'en');
    setNavigatorLanguage('es-ES');

    const service = TestBed.inject(LanguageService);

    expect(service.getLanguage()).toBe('en');
  });

  it('uses Spanish when the system language is Spanish and nothing is saved', () => {
    setNavigatorLanguage('es-ES');

    const service = TestBed.inject(LanguageService);

    expect(service.getLanguage()).toBe('es');
  });

  it('defaults to English for a non-Spanish system language', () => {
    setNavigatorLanguage('fr-FR');

    const service = TestBed.inject(LanguageService);

    expect(service.getLanguage()).toBe('en');
  });

  it('reflects the active language on the html lang attribute', () => {
    setNavigatorLanguage('fr-FR');

    const service = TestBed.inject(LanguageService);
    expect(document.documentElement.lang).toBe('en');

    service.setLanguage('es');
    expect(document.documentElement.lang).toBe('es');
  });
});
