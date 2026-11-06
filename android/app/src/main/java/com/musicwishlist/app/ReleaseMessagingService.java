package com.musicwishlist.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.Objects;

/** Displays rich, actionable release notifications while preserving Capacitor token events. */
public class ReleaseMessagingService extends MessagingService {

    private static final String CHANNEL_ID = "releases";
    private static final String GROUP_KEY = "music-wishlist-releases";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        if (!"release".equals(data.get("type"))) return;

        String albumId = data.get("albumId");
        if (albumId == null || albumId.isEmpty()) return;

        ensureChannel();

        boolean english = "en".equals(data.get("language"));
        String artist = valueOr(data.get("artist"), "Music Wishlist");
        String album = valueOr(data.get("title"), english ? "New release" : "Nuevo lanzamiento");
        String kind = releaseKind(data.get("releaseType"), english);
        String title = (english ? "🎵 New " : "🎵 Nuevo ") + kind + " · " + artist;
        String description = album + (english ? " · Available now" : " · Ya disponible");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification_music)
            .setContentTitle(title)
            .setContentText(description)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(description))
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
            .setColor(Color.rgb(219, 105, 75))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setGroup(GROUP_KEY)
            .setWhen(System.currentTimeMillis())
            .setContentIntent(openReleaseIntent(albumId, false));

        Bitmap cover = downloadCover(data.get("coverUrl"));
        if (cover != null) {
            builder
                .setLargeIcon(cover)
                .setStyle(
                    new NotificationCompat.BigPictureStyle()
                        .bigPicture(cover)
                        .bigLargeIcon((Bitmap) null)
                        .setSummaryText(description)
                );
        }

        builder.addAction(
            R.drawable.ic_notification_add,
            english ? "Add to wishlist" : "Añadir a wishlist",
            openReleaseIntent(albumId, true)
        );
        builder.addAction(
            R.drawable.ic_notification_open,
            english ? "View release" : "Ver lanzamiento",
            openReleaseIntent(albumId, false)
        );

        int notificationId = albumId.hashCode() & 0x7fffffff;
        try {
            NotificationManagerCompat.from(this).notify("release-" + albumId, notificationId, builder.build());
        } catch (SecurityException ignored) {
            // Android's notification permission may have been revoked in Settings.
        }
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(getString(R.string.notification_channel_description));
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    private PendingIntent openReleaseIntent(String albumId, boolean addToWishlist) {
        String route = "musicwishlist:///album/" + Uri.encode(albumId)
            + (addToWishlist ? "?add=true" : "");
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(route), this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int requestCode = Objects.hash(albumId, addToWishlist) & 0x7fffffff;
        return PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private Bitmap downloadCover(String coverUrl) {
        if (coverUrl == null || !coverUrl.startsWith("https://")) return null;

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(coverUrl).openConnection();
            connection.setConnectTimeout(3500);
            connection.setReadTimeout(3500);
            connection.setInstanceFollowRedirects(true);
            connection.connect();
            try (InputStream stream = connection.getInputStream()) {
                return BitmapFactory.decodeStream(stream);
            }
        } catch (Exception ignored) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String releaseKind(String releaseType, boolean english) {
        if ("EP".equalsIgnoreCase(releaseType)) return "EP";
        if ("Álbum".equalsIgnoreCase(releaseType) || "album".equalsIgnoreCase(releaseType)) {
            return english ? "album" : "álbum";
        }
        return "single";
    }

    private String valueOr(String value, String fallback) {
        return value == null || value.isEmpty() ? fallback : value;
    }
}
