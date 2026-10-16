import { Injectable, signal, inject, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import {
  NATIVE_PUSH,
  NativePushRegistration,
} from '../native/native-push';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

export type PushUnsupportedReason =
  | 'no-window'
  | 'no-notification'
  | 'no-service-worker'
  | 'no-push-manager'
  | null;

export function detectUnsupportedReason(env?: {
  win?: unknown;
  nav?: unknown;
}): PushUnsupportedReason {
  const hasWin = env !== undefined && 'win' in env;
  const hasNav = env !== undefined && 'nav' in env;
  const win = hasWin ? env.win : typeof window !== 'undefined' ? window : undefined;
  const nav = hasNav ? env.nav : typeof navigator !== 'undefined' ? navigator : undefined;
  if (!win) return 'no-window';
  if (!('Notification' in (win as object))) return 'no-notification';
  if (!nav || !('serviceWorker' in (nav as object))) return 'no-service-worker';
  if (!('PushManager' in (win as object))) return 'no-push-manager';
  return null;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private nativePush = inject(NATIVE_PUSH);

  readonly isNative = Capacitor.isNativePlatform();
  readonly unsupportedReason = signal<PushUnsupportedReason>(
    this.isNative ? null : detectUnsupportedReason(),
  );
  readonly isSupported = computed(
    () => this.isNative || this.unsupportedReason() === null,
  );

  permissionState = signal<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default',
  );
  isSubscribed = signal(false);
  loading = signal(false);
  lastError = signal<string | null>(null);

  constructor() {
    if (!this.isSupported()) return;
    if (this.isNative) this.initNativeListeners();
    // Keep the server-side registration in sync with the browser subscription.
    // The browser subscription can outlive (or precede) the Firestore record,
    // for example after the server cleaned it up as stale; without this the
    // test/notification flow would hit "no subscription found".
    effect(() => {
      const user = this.auth.currentUser();
      if (user && !this.auth.demoMode()) void this.reconcile();
    });
  }

  private async reconcile(): Promise<void> {
    if (!this.isSupported() || this.auth.demoMode()) return;
    if (this.isNative) {
      await this.reconcileNative();
      return;
    }
    let sub: PushSubscription | null = null;
    try {
      const reg = await navigator.serviceWorker.ready;
      sub = await reg.pushManager.getSubscription();
    } catch {
      return;
    }
    this.isSubscribed.set(!!sub);
    if (!sub) return;

    const user = this.auth.currentUser();
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await firstValueFrom(
        this.http.post(
          '/api/push',
          {
            action: 'subscribe',
            subscription: sub.toJSON(),
            clientId: this.getClientId(),
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
    } catch (err) {
      console.error('[PushNotification] reconcile error:', err);
    }
  }

  private getClientId(): string {
    const KEY = 'mw-client-id';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  async subscribe(): Promise<'granted' | 'denied' | 'error'> {
    this.lastError.set(null);
    if (!this.isSupported() || this.auth.demoMode()) {
      this.lastError.set(this.unsupportedReason() ?? 'demo');
      return 'error';
    }
    if (this.isNative) return this.subscribeNative();
    this.loading.set(true);
    let sub: PushSubscription | null = null;
    try {
      const permission = await Notification.requestPermission();
      this.permissionState.set(permission);
      if (permission !== 'granted') return 'denied';

      const reg = await navigator.serviceWorker.ready;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(environment.vapidPublicKey),
      });

      const user = this.auth.currentUser();
      if (!user) throw new Error('No authenticated user');
      const token = await user.getIdToken();

      await firstValueFrom(
        this.http.post(
          '/api/push',
          {
            action: 'subscribe',
            subscription: sub.toJSON(),
            clientId: this.getClientId(),
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      );
      this.isSubscribed.set(true);
      return 'granted';
    } catch (err) {
      this.lastError.set(errorMessage(err));
      console.error('[PushNotification] subscribe error:', err);
      if (sub) await sub.unsubscribe().catch(() => {});
      return 'error';
    } finally {
      this.loading.set(false);
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.isSupported()) return;
    if (this.isNative) return this.unsubscribeNative();
    this.loading.set(true);
    this.lastError.set(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      const user = this.auth.currentUser();
      if (user && !this.auth.demoMode()) {
        const token = await user.getIdToken();
        await firstValueFrom(
          this.http.post(
            '/api/push',
            { action: 'unsubscribe', clientId: this.getClientId() },
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        );
      }
      this.isSubscribed.set(false);
    } catch (err) {
      this.lastError.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async sendTest(): Promise<boolean> {
    this.lastError.set(null);
    if (!this.isSupported() || this.auth.demoMode()) return false;

    const post = async () => {
      const user = this.auth.currentUser();
      if (!user) throw new Error('No authenticated user');
      const token = await user.getIdToken();
      await firstValueFrom(
        this.http.post(
          '/api/push',
          { action: 'test' },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
    };

    try {
      await post();
      return true;
    } catch (err) {
      // The server may not know about this browser's subscription yet (for
      // example if it was cleaned up as stale). Re-register it and retry once.
      if ((err as { status?: number })?.status === 404) {
        await this.reconcile();
        try {
          await post();
          return true;
        } catch (retryErr) {
          this.lastError.set(errorMessage(retryErr));
          console.error('[PushNotification] sendTest retry error:', retryErr);
          return false;
        }
      }
      this.lastError.set(errorMessage(err));
      console.error('[PushNotification] sendTest error:', err);
      return false;
    }
  }

  private initNativeListeners(): void {
    void this.nativePush.addListener('registration', (data) => {
      this.isSubscribed.set(true);
      void this.persistNativeToken((data as NativePushRegistration).value);
    });
    void this.nativePush.addListener('registrationError', (err) => {
      this.lastError.set(errorMessage(err));
    });
  }

  private async subscribeNative(): Promise<'granted' | 'denied' | 'error'> {
    this.loading.set(true);
    try {
      const permission = await this.nativePush.requestPermissions();
      if (permission.receive !== 'granted') {
        this.permissionState.set('denied');
        return 'denied';
      }
      this.permissionState.set('granted');
      await this.nativePush.register();
      return 'granted';
    } catch (err) {
      this.lastError.set(errorMessage(err));
      return 'error';
    } finally {
      this.loading.set(false);
    }
  }

  private async unsubscribeNative(): Promise<void> {
    this.loading.set(true);
    this.lastError.set(null);
    try {
      await this.postUnsubscribeNative();
      this.isSubscribed.set(false);
    } catch (err) {
      this.lastError.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  private async reconcileNative(): Promise<void> {
    try {
      const permission = await this.nativePush.checkPermissions();
      if (permission.receive !== 'granted') return;
      this.permissionState.set('granted');
      await this.nativePush.register();
    } catch {
      // Plugin unavailable; nothing to reconcile.
    }
  }

  private async persistNativeToken(token: string): Promise<void> {
    const user = this.auth.currentUser();
    if (!user || this.auth.demoMode()) return;
    try {
      const idToken = await user.getIdToken();
      await firstValueFrom(
        this.http.post(
          '/api/push',
          {
            action: 'subscribe',
            token,
            platform: 'native',
            clientId: this.getClientId(),
          },
          { headers: { Authorization: `Bearer ${idToken}` } },
        ),
      );
    } catch (err) {
      this.lastError.set(errorMessage(err));
      console.error('[PushNotification] native registration error:', err);
    }
  }

  private async postUnsubscribeNative(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user || this.auth.demoMode()) return;
    const idToken = await user.getIdToken();
    await firstValueFrom(
      this.http.post(
        '/api/push',
        {
          action: 'unsubscribe',
          platform: 'native',
          clientId: this.getClientId(),
        },
        { headers: { Authorization: `Bearer ${idToken}` } },
      ),
    );
  }
}

function errorMessage(err: unknown): string {
  const httpError = err as { error?: { error?: string }; message?: string };
  return httpError?.error?.error ?? httpError?.message ?? String(err);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
