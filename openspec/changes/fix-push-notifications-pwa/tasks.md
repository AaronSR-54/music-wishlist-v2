# Tasks

## 1. Diagnóstico y evidencia

- [ ] 1.1 Verificar en Vercel que existen `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` y `CRON_SECRET`; comprobar que `VAPID_PUBLIC_KEY` coincide con la clave embebida en `environment.ts` (verificación: comparar valores y anotar el resultado).
- [ ] 1.2 Confirmar con logs de `api/check-releases`/`api/push` los códigos de respuesta de `web-push` en un envío real (verificación: revisar logs de Vercel y anotar `statusCode` por dispositivo).
- [ ] 1.3 Revisar en un Android real qué service worker controla la PWA (`chrome://serviceworker-internals` o DevTools remoto) y si hay un `ngsw-worker.js` residual (verificación: anotar el script y scope activos).
- [x] 1.4 Registrar la causa raíz confirmada en `design.md` (sección Open Questions) antes de aplicar arreglos (verificación: causa documentada con evidencia).

## 2. Service worker único

- [x] 2.1 Retirar `"serviceWorker": "ngsw-config.json"` de `angular.json` y `ngsw-config.json`; confirmar con `npm run build` que no se generan `ngsw-worker.js` ni `ngsw.json` en `dist/` (verificación: `find dist -iname '*ngsw*'` sin resultados).
- [x] 2.2 Añadir en `src/main.ts` una limpieza que desregistre `ngsw-worker.js` si existe antes de registrar `service-worker.js`, y verificar en un dispositivo con SW antiguo que queda controlado por `service-worker.js` (verificación: DevTools muestra el script nuevo y scope `/`).
- [x] 2.3 Confirmar que el manejador `push` de `public/service-worker.js` es el que recibe los eventos (verificación: un push de prueba dispara `showNotification`).

## 3. Coherencia VAPID y entorno

- [x] 3.1 Hacer que `scripts/set-env.js` aplique siempre `VAPID_PUBLIC_KEY` (eliminar el retorno temprano cuando `environment.ts` ya contiene `production: true`) y regenerar `environment.ts` (verificación: ejecutar `npm run prebuild` con `VAPID_PUBLIC_KEY` de prueba y comprobar el valor escrito).
- [ ] 3.2 Verificar que la clave pública del cliente y las claves del servidor proceden de la misma pareja VAPID (verificación: crear una suscripción y recibir sin errores 401/403 del push service).

## 4. Cliente: soporte y estado visible

- [x] 4.1 Reforzar `isSupported` en `PushNotificationService` para exigir `Notification`, `PushManager` y `serviceWorker` (`navigator.serviceWorker`), y exponer el motivo cuando no se pueda suscribir (verificación: test unitario en `push-notification.service.spec.ts` cubriendo cada ausencia).
- [x] 4.2 Propagar errores de `subscribe()` (por ejemplo fallo de red o al persistir) con mensaje claro en lugar de `'error'` genérico (verificación: test unitario que simula fallo del `POST /api/push` y comprueba el resultado).
- [x] 4.3 Mostrar en `profile-settings.component.ts` el estado real de permiso, soporte y suscripción (verificación: revisar en Perfil que cada estado se muestra según corresponda).

## 5. Notificación de prueba

- [x] 5.1 Añadir `action: 'test'` a `api/push.js` reutilizando `getUserFromToken` y `webpush.sendNotification` sobre las suscripciones del propio usuario (verificación: `POST /api/push` con `action: 'test'` responde 200 y el dispositivo recibe la notificación).
- [x] 5.2 Añadir en Perfil el botón de notificación de prueba que llama a esa acción y muestra toast de éxito o error (verificación: pulsar el botón con suscripción activa y recibir el aviso en el dispositivo).
- [x] 5.3 Confirmar que no se ha creado ningún archivo nuevo en `api/` (verificación: `ls api/*.js` sigue con 12 endpoints).

## 6. Identidad de la PWA y limpieza de suscripciones

- [x] 6.1 Añadir un campo `id` estable en `public/manifest.json` (verificación: el manifest desplegado incluye `id` y Lighthouse/Chrome lo acepta).
- [x] 6.2 Confirmar que el servidor elimina suscripciones caducadas (404/410) sin afectar a las demás (verificación: probar con una suscripción inválida y comprobar que el resto sigue recibiendo).

## 7. Verificación de integración

- [ ] 7.1 En un Android real con la PWA instalada: activar notificaciones, comprobar el estado en Perfil y recibir la notificación de prueba (verificación: evidencia en el dispositivo).
- [x] 7.2 Ejecutar `npm test` y confirmar que los tests de notificaciones pasan (verificación: salida de Karma en verde).
- [x] 7.3 Bump de versión en `package.json` según el tipo de cambio (micro si es solo `fix:`) y verificar que `src/version.json` se regenera en build (verificación: `npm run build` y `cat src/version.json`).

## Workflow follow-up

- Archivar el cambio cuando los requisitos de revisión del proyecto se cumplan.
- Verificar el resultado archivado.
