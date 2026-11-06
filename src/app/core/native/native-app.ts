import { InjectionToken } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';

export interface NativeAppListenerHandle {
  remove: () => Promise<void>;
}

export interface NativeApp {
  addListener(
    eventName: 'resume',
    listenerFunc: () => void,
  ): Promise<NativeAppListenerHandle>;
}

export const NATIVE_APP = new InjectionToken<NativeApp>('NATIVE_APP', {
  providedIn: 'root',
  factory: () => CapacitorApp as unknown as NativeApp,
});
