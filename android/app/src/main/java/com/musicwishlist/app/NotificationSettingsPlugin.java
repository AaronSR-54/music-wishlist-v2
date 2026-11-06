package com.musicwishlist.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android notifications are managed by the system, so the app cannot offer its
 * own on/off switch. This plugin opens the notification settings screen of the
 * app so a user who denied the permission can still enable it.
 */
@CapacitorPlugin(name = "NotificationSettings")
public class NotificationSettingsPlugin extends Plugin {

    @PluginMethod
    public void openAppNotificationSettings(PluginCall call) {
        String packageName = getContext().getPackageName();
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, packageName);
            getActivity().startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException ex) {
            // Android < 8 has no per-app notification screen: fall back to the
            // app details page, where notifications can still be reached.
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            fallback.setData(Uri.parse("package:" + packageName));
            getActivity().startActivity(fallback);
        }
        call.resolve();
    }
}
