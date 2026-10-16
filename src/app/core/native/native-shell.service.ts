import { Injectable, NgZone, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ThemeService } from '../theme/theme.service';

const BRAND_BACKGROUND = '#22201f';

@Injectable({ providedIn: 'root' })
export class NativeShellService {
  private router = inject(Router);
  private zone = inject(NgZone);
  private theme = inject(ThemeService);

  constructor() {
    if (!Capacitor.isNativePlatform()) return;

    this.initBackButton();
    this.initAppLinks();
    this.initNotificationTaps();

    effect(() => {
      const dark = this.theme.isDarkMode();
      void this.applyStatusBar(dark);
    });

    void SplashScreen.hide();
  }

  private initBackButton(): void {
    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      this.zone.run(() => {
        if (canGoBack) window.history.back();
        else void CapacitorApp.exitApp();
      });
    });
  }

  private initAppLinks(): void {
    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      let path = '/';
      try {
        const parsed = new URL(url);
        path = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
      } catch {
        return;
      }
      this.zone.run(() => void this.router.navigateByUrl(path));
    });
  }

  private initNotificationTaps(): void {
    void PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        const data = (action.notification.data ?? {}) as Record<string, unknown>;
        this.zone.run(() => this.navigateFromData(data, action.actionId));
      },
    );
  }

  private navigateFromData(
    data: Record<string, unknown>,
    actionId?: string,
  ): void {
    if (typeof data['url'] === 'string') {
      void this.router.navigateByUrl(data['url']);
      return;
    }
    const albumId = data['albumId'];
    if (typeof albumId === 'string') {
      const add = actionId === 'add' ? '?add=true' : '';
      void this.router.navigateByUrl(`/album/${albumId}${add}`);
    }
  }

  private async applyStatusBar(dark: boolean): Promise<void> {
    try {
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      await StatusBar.setBackgroundColor({
        color: dark ? BRAND_BACKGROUND : '#e5e0d8',
      });
    } catch {
      // Status bar plugin unavailable (e.g. before the first sync).
    }
  }
}
