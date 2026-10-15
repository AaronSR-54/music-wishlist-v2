import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import {
  PushNotificationService,
  detectUnsupportedReason,
} from './push-notification.service';
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
});
