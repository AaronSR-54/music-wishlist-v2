import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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

  readonly unsupportedReason = signal<PushUnsupportedReason>(
    detectUnsupportedReason(),
  );
  readonly isSupported = computed(() => this.unsupportedReason() === null);

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
    this.syncSubscriptionState();
  }

  private async syncSubscriptionState(): Promise<void> {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      this.isSubscribed.set(!!sub);
    } catch {
      this.isSubscribed.set(false);
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
      this.lastError.set(err instanceof Error ? err.message : String(err));
      console.error('[PushNotification] subscribe error:', err);
      if (sub) await sub.unsubscribe().catch(() => {});
      return 'error';
    } finally {
      this.loading.set(false);
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.isSupported()) return;
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
      this.lastError.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async sendTest(): Promise<boolean> {
    this.lastError.set(null);
    if (!this.isSupported() || this.auth.demoMode()) return false;
    try {
      const user = this.auth.currentUser();
      if (!user) throw new Error('No authenticated user');
      const token = await user.getIdToken();
      await firstValueFrom(
        this.http.post(
          '/api/push',
          { action: 'test' },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      );
      return true;
    } catch (err) {
      this.lastError.set(err instanceof Error ? err.message : String(err));
      console.error('[PushNotification] sendTest error:', err);
      return false;
    }
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
