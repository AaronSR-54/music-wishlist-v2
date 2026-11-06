import { InjectionToken } from '@angular/core';
import { PushNotifications } from '@capacitor/push-notifications';

export type NativePushPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'prompt-with-rationale';

export interface NativePushPermission {
  receive: NativePushPermissionState;
}

export interface NativePushRegistration {
  value: string;
}

export interface NativePushChannel {
  id: string;
  name: string;
  description?: string;
  sound?: string;
  importance?: number;
  visibility?: number;
  vibration?: boolean;
  lights?: boolean;
}

export interface NativePushListenerHandle {
  remove: () => Promise<void>;
}

export interface NativePush {
  requestPermissions(): Promise<NativePushPermission>;
  checkPermissions(): Promise<NativePushPermission>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  createChannel(channel: NativePushChannel): Promise<void>;
  addListener(
    eventName: 'registration' | 'registrationError',
    listenerFunc: (data: unknown) => void,
  ): Promise<NativePushListenerHandle>;
}

export const NATIVE_PUSH = new InjectionToken<NativePush>('NATIVE_PUSH', {
  providedIn: 'root',
  factory: () => PushNotifications as unknown as NativePush,
});
