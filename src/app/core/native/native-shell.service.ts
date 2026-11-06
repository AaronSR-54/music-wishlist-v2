import { Injectable, NgZone, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { ThemeService } from '../theme/theme.service';
import { LanguageService } from '../i18n/language.service';
import {
  PushNotificationService,
  RELEASE_CHANNEL_ID,
} from '../services/push-notification.service';

const BRAND_BACKGROUND = '#22201f';

@Injectable({ providedIn: 'root' })
export class NativeShellService {
  private router = inject(Router);
  private zone = inject(NgZone);
  private theme = inject(ThemeService);
  private language = inject(LanguageService);
  private push = inject(PushNotificationService);

  constructor() {
    if (!Capacitor.isNativePlatform()) return;

    this.initBackButton();
    this.initAppLinks();
    this.initNotificationTaps();

    effect(() => {
      const dark = this.theme.isDarkMode();
      void this.applySystemBars(dark);
    });

    void this.startNotifications();
  }

  /**
   * The Android system owns the notification permission: ask once on the first
   * launch after the splash and register the device as soon as it is granted.
   */
  private async startNotifications(): Promise<void> {
    await SplashScreen.hide();
    const t = this.language.t();
    await this.push.initializeNative({
      id: RELEASE_CHANNEL_ID,
      name: t.notificationChannelName,
      description: t.notificationChannelDescription,
      importance: 4,
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
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

  private async applySystemBars(dark: boolean): Promise<void> {
    try {
      await SystemBars.setStyle({
        style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      });
    } catch {
      // SystemBars plugin unavailable (e.g. before the first sync).
    }

    try {
      await StatusBar.setBackgroundColor({
        color: dark ? BRAND_BACKGROUND : '#e5e0d8',
      });
    } catch {
      // Best-effort on pre-Android-15; a no-op on Android 15+ edge-to-edge.
    }
  }
}
