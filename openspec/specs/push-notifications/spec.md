# push-notifications Specification

## Purpose

Entrega notificaciones Web Push a la PWA instalada en Android para avisar de nuevos
lanzamientos de artistas favoritos y de descargas en una wishlist compartida, gestionando
la suscripción por dispositivo y su presentación al pulsar el usuario.

## Requirements

### Requirement: Suscripción a notificaciones desde la app
La app SHALL permitir al usuario activar y desactivar las notificaciones desde Perfil, y
SHALL reflejar su estado real en la interfaz.

#### Scenario: Activación exitosa
- **WHEN** el usuario pulsa "Activar notificaciones" y concede el permiso
- **THEN** la app crea una suscripción push y la muestra como activada

#### Scenario: Permiso denegado
- **WHEN** el usuario pulsa "Activar notificaciones" y el navegador deniega el permiso
- **THEN** la app muestra un aviso de permiso bloqueado y no deja la suscripción como activa

#### Scenario: Contexto sin soporte
- **WHEN** el dispositivo no soporta Web Push
- **THEN** la app indica que las notificaciones no están soportadas en lugar de mostrar el botón

### Requirement: Una suscripción por dispositivo
La app SHALL identificar cada dispositivo de forma estable y SHALL almacenar su
suscripción por separado, de modo que varios dispositivos del mismo usuario reciban
notificaciones de forma independiente.

#### Scenario: Varios dispositivos
- **WHEN** un mismo usuario activa notificaciones en dos dispositivos
- **THEN** el servidor conserva una suscripción por cada dispositivo identificado

#### Scenario: Desactivación en un dispositivo
- **WHEN** el usuario desactiva notificaciones en un dispositivo
- **THEN** solo se elimina la suscripción de ese dispositivo y el resto sigue recibiendo avisos

### Requirement: Reconciliación de la suscripción con el servidor
La app SHALL registrar en el servidor la suscripción push ya existente del navegador cuando
el usuario está autenticado, de modo que la suscripción del dispositivo y su registro en el
servidor permanezcan sincronizados.

#### Scenario: Suscripción del navegador sin registro en el servidor
- **WHEN** el navegador ya tiene una suscripción push pero el servidor no tiene registro de ese dispositivo
- **THEN** la app reenvía la suscripción al servidor al autenticarse el usuario

#### Scenario: Recuperación al probar
- **WHEN** el envío de prueba falla porque el servidor no conoce la suscripción
- **THEN** la app vuelve a registrar la suscripción y reintenta el envío

### Requirement: Entrega de notificaciones al dispositivo suscrito
El servidor SHALL enviar la notificación a todas las suscripciones vigentes del usuario
destinatario y SHALL registrar el resultado de cada envío.

#### Scenario: Envío a suscripciones vigentes
- **WHEN** se genera una notificación para un usuario con suscripciones registradas
- **THEN** el servidor envía el mensaje a cada suscripción vigente

#### Scenario: Suscripción caducada
- **WHEN** el servicio de push responde que una suscripción ya no es válida
- **THEN** el servidor elimina esa suscripción y continúa con las demás

### Requirement: Presentación y apertura de la notificación
El service worker SHALL mostrar la notificación recibida y SHALL abrir o enfocar la app en
la vista correspondiente al pulsarla o al usar una acción de la notificación.

#### Scenario: Notificación de nuevo lanzamiento
- **WHEN** llega un push de lanzamiento
- **THEN** el service worker muestra una notificación con título, artista, portada y las
  acciones de añadir a wishlist y ver release

#### Scenario: Apertura desde la notificación
- **WHEN** el usuario pulsa el cuerpo de la notificación o una de sus acciones
- **THEN** la app se abre o se enfoca en el álbum correspondiente, añadiéndolo a la
  wishlist si la acción fue "añadir"

### Requirement: Notificación de descarga en wishlist compartida
Cuando un destinatario marca un elemento compartido como descargado, el sistema SHALL
notificar al propietario de la wishlist si tiene notificaciones activas.

#### Scenario: Descarga por un destinatario
- **WHEN** un destinatario con acceso marca un elemento como descargado
- **THEN** se envía una notificación al propietario indicando quién lo descargó y qué elemento es

#### Scenario: Destinatario no autorizado
- **WHEN** un usuario sin acceso compartido intenta notificar al propietario
- **THEN** el servidor rechaza la solicitud de notificación

### Requirement: Diagnóstico visible del estado de notificaciones
La app SHALL exponer en Perfil el estado de permiso, la existencia de suscripción y una
forma de verificar la entrega en el propio dispositivo.

#### Scenario: Estado visible
- **WHEN** el usuario abre Perfil
- **THEN** la app muestra si las notificaciones están soportadas, si el permiso está
  concedido o bloqueado y si existe una suscripción activa

#### Scenario: Verificación de entrega
- **WHEN** el usuario solicita una notificación de prueba con suscripción activa
- **THEN** el dispositivo recibe la notificación de prueba

### Requirement: Coherencia de claves VAPID
La clave pública VAPID usada por el cliente SHALL proceder de la misma pareja de claves
que utiliza el servidor para firmar los envíos.

#### Scenario: Claves alineadas
- **WHEN** la app crea una suscripción
- **THEN** la suscripción puede recibir envíos firmados por el servidor con la clave privada correspondiente

### Requirement: Un solo responsable de los eventos push
SHALL existir un único service worker controlando el ámbito de la app, de forma que los
eventos `push` y `notificationclick` se manejen siempre por el mismo código.

#### Scenario: Evento push manejado
- **WHEN** el dispositivo recibe un push estando la app instalada
- **THEN** el service worker activo ejecuta el manejador de push que muestra la notificación
