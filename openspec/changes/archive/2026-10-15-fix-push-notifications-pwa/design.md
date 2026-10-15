# Design

## Context

La app es una SPA Angular desplegada en Vercel como PWA instalable. Ver `proposal.md` para
la motivación. Estado actual relevante, verificado en el código y en la build desplegada:

- El único service worker registrado en producción es `public/service-worker.js`, desde
  `src/main.ts` (con `?v=<version>`); contiene los manejadores `push`/`notificationclick`.
- `angular.json` define `"serviceWorker": "ngsw-config.json"` en producción, lo que genera
  `ngsw-worker.js` y `ngsw.json` (presentes en `dist/` y desplegados) pero **no** registra
  nada; aun así es una fuente de conflicto latente si en el futuro se registrara.
- `environment.ts` incluye `vapidPublicKey` fija y `scripts/set-env.js` retorna sin
  regenerar cuando el fichero ya contiene `production: true`, por lo que la variable de
  entorno `VAPID_PUBLIC_KEY` puede quedar ignorada.
- El servidor (`api/push.js`, `api/check-releases.js`) usa `web-push` con claves VAPID de
  entorno y guarda suscripciones en `push-subscriptions/{uid}` (mapa por `clientId`).
- La causa raíz exacta no está confirmada: puede ser configuración de entorno, clave VAPID
  desalineada o un service worker residual en dispositivos ya instalados.

## Goals / Non-Goals

**Goals:**
- Confirmar dónde se rompe el pipeline (suscripción, almacenamiento, envío o recepción).
- Dejar un único responsable de los eventos push y eliminar la configuración de service
  worker que no se usa.
- Alinear la clave VAPID cliente/servidor con una única fuente de verdad.
- Permitir verificar la entrega en el propio dispositivo sin depender del cron diario.
- Añadir estado visible y mensajes de error útiles en Perfil.

**Non-Goals:**
- Integración nativa FCM para la app Android (sesión paralela, fuera de alcance).
- Rediseñar el formato o los textos de las notificaciones existentes.
- Crear nuevos endpoints de API (límite Vercel 12/12).

## Decisions

- **Un solo service worker.** Quedarse con `public/service-worker.js` y retirar la opción
  `serviceWorker: ngsw-config.json` de `angular.json` (y, si aplica, `ngsw-config.json`).
  Alternativa descartada: usar `ngsw-worker.js`, porque el service worker de Angular no
  permite añadir manejadores `push` personalizados sin reescribir su importScripts.
  Efecto secundario: hay que asegurar que dispositivos con un `ngsw-worker.js` residual lo
  desregistren y que el `service-worker.js` reclame los clientes.

- **Diagnóstico por fases antes de tocar comportamiento.** Instrumentar y verificar
  (estado de suscripción, respuesta del push service, logs del servidor) para localizar el
  fallo real, en lugar de aplicar múltiples arreglos a ciegas. El trabajo se organiza para
  recoger evidencia primero.

- **Notificación de prueba reutilizando `api/push.js`.** Añadir un `action: 'test'` al
  endpoint existente en vez de crear `api/test-push.js`, respetando el límite de 12
  endpoints. El servidor reutiliza `getUserFromToken` y `webpush.sendNotification` sobre
  las suscripciones del propio usuario.

- **VAPID con una única fuente de verdad.** Corregir `scripts/set-env.js` para que
  `VAPID_PUBLIC_KEY` del entorno se aplique siempre, o documentar la clave fija como la
  oficial y verificarla contra `VAPID_PRIVATE_KEY` del servidor. Preferido: que el entorno
  mande, para no poder desincronizarse.

- **Detección de soporte robusta en el cliente.** `isSupported` debe comprobar además que
  existe un service worker registrado (`navigator.serviceWorker` + `PushManager`) y
  exponer el motivo cuando no se pueda suscribir, en lugar de fallar en silencio.

- **Añadir `id` al manifest.** Incluir un `id` estable en `manifest.json` para que la
  identidad de la app instalada no cambie entre despliegues (evita perder la suscripción
  asociada al reinstalarse/actualizarse la PWA).

## Risks / Trade-offs

- [Service worker residual en dispositivos ya instalados] → incluir `skipWaiting`,
  `clients.claim` y una limpieza que desregistre `ngsw-worker.js` si está presente.
- [Caché inmutable de `.js` en Vercel] → el SW ya usa `?v=<version>`; asegurar que el
  cambio de versión fuerza actualización.
- [Variables de entorno no configuradas en Vercel] → el diagnóstico debe fallar de forma
  visible (log y estado en la app) en vez de silenciosamente.
- [Cron diario de lanzamientos hace difícil probar] → el `action: 'test'` permite validar
  entrega sin esperar a las 09:00 UTC ni a un lanzamiento nuevo.
- [Doze/ahorro de batería en Android puede retrasar o descartar avisos] → documentarlo;
  no es corregible desde la web.
- [No se puede reproducir sin un dispositivo Android] → las tareas incluyen verificación
  en dispositivo físico y registro de evidencia.

## Migration Plan

1. Confirmar causa raíz con la instrumentación y las pruebas en dispositivo.
2. Desplegar el service worker único y asegurar que reemplaza cualquier SW anterior.
3. Aplicar el arreglo de VAPID/entorno y verificar la variable en Vercel.
4. Desplegar el diagnóstico y la notificación de prueba; validar en un dispositivo Android.
5. Rollback: cada cambio es independiente; revertir el commit correspondiente y volver a
   desplegar. No hay migración de datos: `push-subscriptions` se puede repoblar reactivando
   las notificaciones.

## Open Questions

Resueltas con el diagnóstico independiente (Chromium headless + CDP y pruebas locales con
claves VAPID propias), sin acceso a Vercel ni a un Android físico:

- **El camino cliente/SW funciona.** En Chromium, `service-worker.js` (scope `/`) es el
  único SW que controla la PWA de producción y su manejador `push` muestra la notificación
  (lanzamiento y prueba). No aparecía `ngsw-worker.js` residual en un perfil limpio.
- **El pipeline de servidor funciona.** Con claves VAPID propias y un push service local,
  `api/push.js` firma y envía correctamente (`action: 'test'`) y elimina suscripciones que
  responden 410 sin afectar a las demás.
- **La clave pública VAPID del cliente es válida** (punto P-256 sin comprimir, 65 bytes).

**Causa raíz confirmada (prueba en dispositivo real):** la suscripción del navegador y su
registro en Firestore se habían desincronizado. El navegador conservaba una suscripción
push (`isSubscribed` mostraba "Enabled" y aparecía el botón de prueba), pero
`push-subscriptions/{uid}` no existía en el servidor, así que `action: 'test'` respondía 404
"no subscription found". Al re-suscribir (Desactivar → Activar) se reescribió el registro y
la notificación llegó; con el botón de prueba aparecía el toast de error antes de hacerlo.

Todas las variables de entorno existen en Vercel (`vercel env ls`: `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `CRON_SECRET`,
`VAPID_SUBJECT`, `RELEASE_WINDOW_DAYS`) y la entrega real funciona, así que las claves VAPID
del cliente y del servidor coinciden.

**Arreglo aplicado:** `PushNotificationService` ahora reconcilia al autenticarse (reenvía al
servidor la suscripción del navegador si existe) y `sendTest` se recupera ante un 404
re-registrando y reintentando, para que la divergencia no vuelva a dejar las notificaciones
sin funcionar.
