import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import {
  PushNotificationService,
  detectUnsupportedReason,
} from './push-notification.service';
import { NATIVE_PUSH } from '../native/native-push';
import { NATIVE_APP } from '../native/native-app';
import { AuthService } from '../auth/auth.service';

describe('detectUnsupportedReason', () => {
  it('returns no-window when window is absent', () => {
    expect(detectUnsupportedReason({ win: undefined, nav: undefined })).toBe(
      'no-window',
    );
  });

  it('returns no-notification when Notification is missing', () => {
    expect(detectUnsupportedReason({ win: {}, nav: {} })).toBe('no-notification');
  });

  it('returns no-service-worker when serviceWorker is missing', () => {
    expect(
      detectUnsupportedReason({ win: { Notification: {} }, nav: {} }),
    ).toBe('no-service-worker');
  });

  it('returns no-push-manager when PushManager is missing', () => {
    expect(
      detectUnsupportedReason({
        win: { Notification: {} },
        nav: { serviceWorker: {} },
      }),
    ).toBe('no-push-manager');
  });

  it('returns null when every API is present', () => {
    expect(
      detectUnsupportedReason({
        win: { Notification: {}, PushManager: {} },
        nav: { serviceWorker: {} },
      }),
    ).toBeNull();
  });
});

describe('PushNotificationService', () => {
  let httpPost: jasmine.Spy;
  let auth: { demoMode: () => boolean; currentUser: () => unknown };
  let nativePush: {
    requestPermissions: jasmine.Spy;
    checkPermissions: jasmine.Spy;
    register: jasmine.Spy;
    unregister: jasmine.Spy;
    createChannel: jasmine.Spy;
    addListener: jasmine.Spy;
  };
  let nativeApp: { addListener: jasmine.Spy };
  let resumeCallback: (() => void) | null;

  const fakeSub = {
    endpoint: 'https://example.com/push',
    toJSON: () => ({ endpoint: 'https://example.com/push' }),
    unsubscribe: async () => true,
  };

  beforeEach(() => {
    httpPost = jasmine.createSpy('post');
    auth = {
      demoMode: () => false,
      currentUser: () => ({ getIdToken: async () => 'token' }),
    };
    nativePush = {
      requestPermissions: jasmine
        .createSpy('requestPermissions')
        .and.resolveTo({ receive: 'granted' }),
      checkPermissions: jasmine
        .createSpy('checkPermissions')
        .and.resolveTo({ receive: 'granted' }),
      register: jasmine.createSpy('register').and.resolveTo(),
      unregister: jasmine.createSpy('unregister').and.resolveTo(),
      createChannel: jasmine.createSpy('createChannel').and.resolveTo(),
      addListener: jasmine
        .createSpy('addListener')
        .and.resolveTo({ remove: async () => {} }),
    };
    resumeCallback = null;
    nativeApp = {
      addListener: jasmine
        .createSpy('nativeApp.addListener')
        .and.callFake((_event: string, callback: () => void) => {
          resumeCallback = callback;
          return Promise.resolve({ remove: async () => {} });
        }),
    };
    localStorage.removeItem('mw-native-notif-asked-v1');

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            subscribe: async () => fakeSub,
            getSubscription: async () => fakeSub,
          },
        }),
        getRegistrations: async () => [],
      },
    });
    spyOn(Notification, 'requestPermission').and.resolveTo('granted');

    TestBed.configureTestingModule({
      providers: [
        PushNotificationService,
        { provide: HttpClient, useValue: { post: httpPost } },
        { provide: AuthService, useValue: auth },
        { provide: NATIVE_PUSH, useValue: nativePush },
        { provide: NATIVE_APP, useValue: nativeApp },
      ],
    });
  });

  afterEach(() => {
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
  });

  it('subscribe returns granted and marks subscribed on success', async () => {
    httpPost.and.returnValue(of({ ok: true }));
    const svc = TestBed.inject(PushNotificationService);

    expect(await svc.subscribe()).toBe('granted');
    expect(svc.isSubscribed()).toBeTrue();
    expect(svc.lastError()).toBeNull();
  });

  it('subscribe propagates persistence errors with a message', async () => {
    httpPost.and.returnValue(throwError(() => new Error('network down')));
    const svc = TestBed.inject(PushNotificationService);

    expect(await svc.subscribe()).toBe('error');
    expect(svc.lastError()).toContain('network down');
  });

  it('sendTest propagates errors with a message', async () => {
    httpPost.and.returnValue(throwError(() => new Error('boom')));
    const svc = TestBed.inject(PushNotificationService);

    expect(await svc.sendTest()).toBeFalse();
    expect(svc.lastError()).toContain('boom');
  });

  it('sendTest returns true on success', async () => {
    httpPost.and.returnValue(of({ ok: true }));
    const svc = TestBed.inject(PushNotificationService);

    expect(await svc.sendTest()).toBeTrue();
  });

  it('uses the native plugin to subscribe on a native platform', async () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);

    const svc = TestBed.inject(PushNotificationService);

    expect(svc.isNative).toBeTrue();
    expect(await svc.subscribe()).toBe('granted');
    expect(nativePush.requestPermissions).toHaveBeenCalled();
    expect(nativePush.register).toHaveBeenCalled();
  });

  it('sendTest re-registers the browser subscription and retries after a 404', async () => {
    let testCalls = 0;
    httpPost.and.callFake((_url: string, body: { action: string }) => {
      if (body.action === 'test') {
        testCalls++;
        return testCalls === 1
          ? throwError(() => ({
              status: 404,
              error: { error: 'No push subscription found' },
            }))
          : of({ ok: true });
      }
      return of({ ok: true });
    });
    const svc = TestBed.inject(PushNotificationService);

    expect(await svc.sendTest()).toBeTrue();
    const subscribeCall = httpPost.calls
      .allArgs()
      .find((args) => (args[1] as { action: string }).action === 'subscribe');
    expect(subscribeCall).toBeTruthy();
  });

  describe('native permission lifecycle', () => {
    const channel = { id: 'releases', name: 'Nuevos lanzamientos' };

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    });

    it('creates the channel and registers when the permission is already granted', async () => {
      const svc = TestBed.inject(PushNotificationService);

      await svc.initializeNative(channel);

      expect(nativePush.createChannel).toHaveBeenCalledWith(channel);
      expect(nativePush.requestPermissions).not.toHaveBeenCalled();
      expect(nativePush.register).toHaveBeenCalled();
      expect(svc.permissionState()).toBe('granted');
    });

    it('requests the permission once per install and registers on grant', async () => {
      nativePush.checkPermissions.and.resolveTo({ receive: 'prompt' });
      nativePush.requestPermissions.and.resolveTo({ receive: 'granted' });
      const svc = TestBed.inject(PushNotificationService);

      await svc.initializeNative(channel);
      nativePush.checkPermissions.and.resolveTo({ receive: 'granted' });
      await svc.initializeNative(channel);

      expect(nativePush.requestPermissions).toHaveBeenCalledTimes(1);
      expect(nativePush.register).toHaveBeenCalled();
      expect(svc.permissionState()).toBe('granted');
      expect(localStorage.getItem('mw-native-notif-asked-v1')).toBe('1');
    });

    it('does not prompt again after a denial', async () => {
      nativePush.checkPermissions.and.resolveTo({ receive: 'prompt' });
      nativePush.requestPermissions.and.resolveTo({ receive: 'denied' });
      const svc = TestBed.inject(PushNotificationService);

      await svc.initializeNative(channel);
      nativePush.checkPermissions.and.resolveTo({ receive: 'denied' });
      await svc.initializeNative(channel);

      expect(nativePush.requestPermissions).toHaveBeenCalledTimes(1);
      expect(nativePush.register).not.toHaveBeenCalled();
      expect(svc.permissionState()).toBe('denied');
    });

    it('registers on resume when the permission was granted in Android settings', async () => {
      nativePush.checkPermissions.and.resolveTo({ receive: 'denied' });
      const svc = TestBed.inject(PushNotificationService);
      await svc.initializeNative(channel);
      expect(nativePush.register).not.toHaveBeenCalled();

      nativePush.checkPermissions.and.resolveTo({ receive: 'granted' });
      resumeCallback?.();
      await new Promise((resolve) => setTimeout(resolve));

      expect(nativePush.register).toHaveBeenCalled();
      expect(svc.permissionState()).toBe('granted');
    });

    it('drops the server registration when the permission is revoked', async () => {
      httpPost.and.returnValue(of({ ok: true }));
      const svc = TestBed.inject(PushNotificationService);
      await svc.initializeNative(channel);
      expect(svc.permissionState()).toBe('granted');

      nativePush.checkPermissions.and.resolveTo({ receive: 'denied' });
      resumeCallback?.();
      await new Promise((resolve) => setTimeout(resolve));

      expect(svc.permissionState()).toBe('denied');
      expect(svc.isSubscribed()).toBeFalse();
      const unsubscribeCall = httpPost.calls
        .allArgs()
        .find(
          (args) =>
            (args[1] as { action: string; platform?: string }).action ===
              'unsubscribe' &&
            (args[1] as { platform?: string }).platform === 'native',
        );
      expect(unsubscribeCall).toBeTruthy();
    });
  });
});
