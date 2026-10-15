# Tasks

## 1. Presupuesto de tiempo del cron
- [x] Añadir `maxDuration: 60` para `api/check-releases.js` en `vercel.json`
- [x] Procesar artistas de cada usuario con concurrencia acotada (`FETCH_CONCURRENCY`)
- [x] Procesar usuarios con concurrencia acotada (`USER_CONCURRENCY`)

## 2. Deduplicación correcta
- [x] Escribir el caché de notificados solo tras un envío correcto
- [x] Registrar en el caché únicamente los lanzamientos realmente enviados

## 3. Observabilidad
- [x] Registrar en logs solo los lanzamientos nuevos (y su estado `alreadyNotified`)
- [x] Añadir `?cacheId=` opcional para verificar con caché limpio

## 4. Verificación
- [x] Confirmar que el cron termina (`Final:`) con ventana de 1 día
- [x] Confirmar envío real (`Sending ... for <artista>`) y `Final: notified>0` con caché limpio
- [x] Confirmar recepción en el dispositivo del usuario
