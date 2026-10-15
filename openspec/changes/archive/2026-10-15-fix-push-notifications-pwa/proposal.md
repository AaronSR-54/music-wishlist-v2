# Proposal

## Why

Las notificaciones push no llegan en la PWA instalada en Android (WebAPK), aunque la app
web sí las anuncia como disponibles. El usuario depende de ellas para avisos de nuevos
lanzamientos de sus artistas favoritos y de descargas de su wishlist compartida, así que
la app promete una función que en la práctica no cumple. Hay además indicios de
configuración divergente (clave VAPID del cliente, service workers duplicados y variables
de entorno del servidor) que hacen la causa raíz incierta.

## What Changes

- Diagnosticar de extremo a extremo el pipeline de Web Push: suscripción del cliente →
  almacenamiento en Firestore (`push-subscriptions/{uid}`) → envío desde
  `api/push.js` y `api/check-releases.js` → recepción en el `push` event del service worker.
- Garantizar que un único service worker controla la página: resolver la presencia
  simultánea de `ngsw-worker.js`/`ngsw.json` (configurados en `angular.json`) y del
  `service-worker.js` personalizado registrado desde `src/main.ts`, que hoy compiten por el
  scope `/` y podrían dejar los `push` events sin manejar.
- Endurecer `PushNotificationService` en contextos instalados: detectar soporte real de
  push, manejar permisos ya denegados, exponer errores y confirmar que la suscripción
  creada se persiste correctamente.
- Verificar la coherencia VAPID: la clave pública embebida en el cliente
  (`environment.vapidPublicKey`) debe coincidir con `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`
  del servidor; `scripts/set-env.js` hoy ignora la variable de entorno si
  `environment.ts` ya contiene `production: true`.
- Añadir diagnóstico visible en Perfil (estado de permiso, si hay suscripción, endpoint y
  un botón de "notificación de prueba") reutilizando `api/push.js` con un nuevo `action`
  para no crear endpoints (límite Vercel 12/12).
- Confirmar el estado de configuración del servidor (claves VAPID, `FIREBASE_PRIVATE_KEY`,
  `CRON_SECRET`) y del cron diario como parte del diagnóstico.

## Capabilities

### New Capabilities
- `push-notifications`: entrega de notificaciones Web Push a la PWA instalada en Android
  (suscripción y preferencia del usuario, almacenamiento por dispositivo, envío desde el
  servidor y presentación/click en el service worker).

### Modified Capabilities
<!-- Ninguna: no existen specs previas en openspec/specs/. -->

## Impact

- **Cliente**: `src/app/core/services/push-notification.service.ts`,
  `src/app/features/profile/sections/profile-settings.component.ts`, `src/main.ts`,
  `src/environments/environment.ts` (clave VAPID).
- **Service worker**: `public/service-worker.js` (registro único y manejo de `push`).
- **Build/config**: `angular.json` (opción `serviceWorker: ngsw-config.json`),
  `ngsw-config.json`, `scripts/set-env.js`.
- **Servidor**: `api/push.js`, `api/check-releases.js` (sin nuevos endpoints),
  variables de entorno en Vercel (`VAPID_*`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`, `CRON_SECRET`).
- **Firestore**: colección `push-subscriptions/{uid}` (ya cubierta por `firestore.rules`);
  `artist-releases-cache` para deduplicar lanzamientos.
- **Fuera de alcance**: la app nativa Android (FCM nativo) que se trabaja en otra sesión
  paralela; este cambio solo cubre la PWA instalada.
