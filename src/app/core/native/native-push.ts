import { InjectionToken } from '@angular/core';
import { PushNotifications } from '@capacitor/push-notifications';

export interface NativePushPermission {
  receive: string;
}

export interface NativePushRegistration {
  value: string;
}

export interface NativePushListenerHandle {
  remove: () => Promise<void>;
}

export interface NativePush {
  requestPermissions(): Promise<NativePushPermission>;
  checkPermissions(): Promise<NativePushPermission>;
  register(): Promise<void>;
  addListener(
    eventName: 'registration' | 'registrationError',
    listenerFunc: (data: unknown) => void,
  ): Promise<NativePushListenerHandle>;
}

export const NATIVE_PUSH = new InjectionToken<NativePush>('NATIVE_PUSH', {
  providedIn: 'root',
  factory: () => PushNotifications as unknown as NativePush,
});
