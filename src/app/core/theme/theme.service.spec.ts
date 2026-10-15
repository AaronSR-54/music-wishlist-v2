import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { ToastService } from '../../shared/components/toast/toast.component';

describe('ThemeService', () => {
  let service: ThemeService;

  function themeColorMeta(): HTMLMetaElement {
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    return meta;
  }

  beforeEach(() => {
    localStorage.clear();
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.remove());
    themeColorMeta();

    TestBed.configureTestingModule({});
    spyOn(TestBed.inject(ToastService), 'success');
    service = TestBed.inject(ThemeService);
    TestBed.tick();
  });

  afterEach(() => {
    localStorage.clear();
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.remove());
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
  });

  it('sets the dark theme-color when the dark theme is selected', () => {
    service.setTheme('dark');
    TestBed.tick();

    expect(themeColorMeta().getAttribute('content')).toBe('#22201f');
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
  });

  it('sets the light theme-color when the light theme is selected', () => {
    service.setTheme('light');
    TestBed.tick();

    expect(themeColorMeta().getAttribute('content')).toBe('#e5e0d8');
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
  });
});
