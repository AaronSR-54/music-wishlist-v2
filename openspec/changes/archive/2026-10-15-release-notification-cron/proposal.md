# Proposal

## Why

El chequeo diario de nuevos lanzamientos (`api/check-releases`) no entrega los avisos que
promete. Dos defectos se combinan:

- La ejecución se corta por timeout antes de llegar a la fase de envío, porque procesa a
  todos los usuarios y artistas en serie contra la API de Deezer.
- Los lanzamientos se marcan como "notificados" en Firestore *antes* de enviarse, así que
  una ejecución interrumpida los descarta sin haber avisado ("se tragan").

Resultado: el usuario no recibe avisos de nuevos lanzamientos de sus artistas favoritos y
los que sí se detectaron quedan marcados, por lo que no se reintentan.

## What Changes

- Acotar el tiempo de ejecución del cron: límite de función (`maxDuration: 60`) y
  concurrencia acotada al procesar usuarios y artistas.
- Escribir el estado de "notificado" en el caché **solo después** de un envío correcto.
- Registrar en los logs únicamente los lanzamientos nuevos (menos ruido, cabe en el
  límite de registros).
- Añadir un `?cacheId=` opcional para verificar el comportamiento con un caché limpio
  (soporte de pruebas, sin efecto en el flujo normal).

## Capabilities

### Modified Capabilities
- `push-notifications`: añade requisitos de detección y entrega de nuevos lanzamientos por
  el chequeo programado, su finalización dentro del presupuesto de tiempo y el marcado
  como notificado solo tras enviar.

## Impact

- **Servidor**: `api/check-releases.js` (concurrencia, orden de escritura del caché,
  logs), `vercel.json` (`functions."api/check-releases.js".maxDuration`).
- **Firestore**: colección `artist-releases-cache` (deduplicación de lanzamientos ya
  avisados).
- **Sin nuevos endpoints** (se mantiene el límite de 12 de Vercel).
- **Fuera de alcance**: la entrega Web Push en sí (suscripción, service worker, VAPID),
  ya cubierta por el cambio `fix-push-notifications-pwa`.
