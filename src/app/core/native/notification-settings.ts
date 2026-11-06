import { registerPlugin } from '@capacitor/core';

export interface NotificationSettingsPlugin {
  openAppNotificationSettings(): Promise<void>;
}

/**
 * Local Capacitor plugin (see
 * `android/app/src/main/java/com/musicwishlist/app/NotificationSettingsPlugin.java`)
 * that opens the Android notification settings of the app.
 */
export const NotificationSettings =
  registerPlugin<NotificationSettingsPlugin>('NotificationSettings');
