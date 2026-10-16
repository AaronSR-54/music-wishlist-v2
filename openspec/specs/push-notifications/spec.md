# push-notifications Specification

## Purpose

Entrega notificaciones Web Push a la PWA instalada en Android para avisar de nuevos
lanzamientos de artistas favoritos y de descargas en una wishlist compartida, gestionando
la suscripción por dispositivo y su presentación al pulsar el usuario.

## Requirements

### Requirement: Suscripción a notificaciones desde la app
La app SHALL permitir al usuario activar y desactivar las notificaciones desde Perfil, y
SHALL reflejar su estado real en la interfaz. En el navegador la activación usa Web Push; en
la app nativa usa el permiso del sistema y un token de Firebase Cloud Messaging.

#### Scenario: Activación exitosa
- **WHEN** el usuario pulsa "Activar notificaciones" y concede el permiso
- **THEN** la app crea una suscripción push y la muestra como activada

#### Scenario: Permiso denegado
- **WHEN** el usuario pulsa "Activar notificaciones" y el navegador deniega el permiso
- **THEN** la app muestra un aviso de permiso bloqueado y no deja la suscripción como activa

#### Scenario: Contexto sin soporte
- **WHEN** el dispositivo no soporta Web Push
- **THEN** la app indica que las notificaciones no están soportadas en lugar de mostrar el botón

#### Scenario: Activación en el app nativo
- **WHEN** el usuario activa las notificaciones en la app nativa y concede el permiso del sistema
- **THEN** la app muestra las notificaciones como activadas y registra el token del dispositivo

#### Scenario: Permiso nativo denegado
- **WHEN** el usuario deniega el permiso de notificaciones en la app nativa
- **THEN** la app no deja las notificaciones como activas y ofrece volver a intentarlo desde los ajustes del sistema

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
El cliente SHALL mostrar la notificación recibida y SHALL abrir o enfocar la app en la vista
correspondiente al pulsarla o al usar una acción de la notificación. En la web lo hace el
service worker; en la app nativa lo hace el sistema operativo a través del plugin de
notificaciones.

#### Scenario: Notificación de nuevo lanzamiento
- **WHEN** llega un push de lanzamiento
- **THEN** el service worker muestra una notificación con título, artista, portada y las
  acciones de añadir a wishlist y ver release

#### Scenario: Apertura desde la notificación
- **WHEN** el usuario pulsa el cuerpo de la notificación o una de sus acciones
- **THEN** la app se abre o se enfoca en el álbum correspondiente, añadiéndolo a la
  wishlist si la acción fue "añadir"

#### Scenario: Apertura desde notificación nativa
- **WHEN** el usuario pulsa una notificación en la app nativa
- **THEN** la app se abre en la vista indicada por la notificación

### Requirement: Notificación de descarga en wishlist compartida
Cuando un destinatario marca un elemento compartido como descargado, el sistema SHALL
notificar al propietario de la wishlist si tiene notificaciones activas.

#### Scenario: Descarga por un destinatario
- **WHEN** un destinatario con acceso marca un elemento como descargado
- **THEN** se envía una notificación al propietario indicando quién lo descargó y qué elemento es

#### Scenario: Destinatario no autorizado
- **WHEN** un usuario sin acceso compartido intenta notificar al propietario
- **THEN** el servidor rechaza la solicitud de notificación

### Requirement: Estado de notificaciones visible
La app SHALL reflejar en Perfil si las notificaciones están soportadas, si el permiso está
concedido o bloqueado y el estado de la suscripción del dispositivo.

#### Scenario: Estado visible
- **WHEN** el usuario abre Perfil
- **THEN** la app muestra si las notificaciones están soportadas o bloqueadas y ofrece un
  botón para activarlas o desactivarlas según el estado de la suscripción

### Requirement: Coherencia de claves VAPID
La clave pública VAPID usada por el cliente SHALL proceder de la misma pareja de claves
que utiliza el servidor para firmar los envíos.

#### Scenario: Claves alineadas
- **WHEN** la app crea una suscripción
- **THEN** la suscripción puede recibir envíos firmados por el servidor con la clave privada correspondiente

### Requirement: Un solo responsable de los eventos push
SHALL existir un único service worker controlando el ámbito de la app, de forma que los
eventos `push` y `notificationclick` se manejen siempre por el mismo código. En la app
nativa, un único listener del plugin de notificaciones SHALL manejar la recepción y la
pulsación.

#### Scenario: Evento push manejado
- **WHEN** el dispositivo recibe un push estando la app instalada
- **THEN** el service worker activo ejecuta el manejador de push que muestra la notificación

#### Scenario: Evento nativo manejado
- **WHEN** la app nativa recibe o el usuario pulsa una notificación
- **THEN** el listener del plugin de notificaciones ejecuta el manejador correspondiente

### Requirement: Aviso de nuevos lanzamientos
El sistema SHALL detectar a diario los lanzamientos de los artistas favoritos de cada
usuario y SHALL enviar un aviso push a sus dispositivos suscritos, sin volver a avisar de
lanzamientos ya notificados.

#### Scenario: Lanzamiento nuevo detectado
- **WHEN** un artista favorito publica un lanzamiento que no se había notificado
- **THEN** el sistema envía un aviso push al usuario y lo registra como notificado

#### Scenario: Sin lanzamientos nuevos
- **WHEN** el chequeo diario no encuentra lanzamientos nuevos para un usuario
- **THEN** no se envía ninguna notificación para ese usuario

#### Scenario: Lanzamiento ya notificado
- **WHEN** un lanzamiento ya figura como notificado
- **THEN** el sistema no vuelve a enviar un aviso por él

### Requirement: Finalización del chequeo dentro de su presupuesto de tiempo
El chequeo programado SHALL procesar a todos los usuarios suscritos dentro del límite de
tiempo de ejecución de la función, procesando usuarios y artistas con concurrencia acotada.

#### Scenario: Muchos usuarios y artistas
- **WHEN** hay muchos usuarios suscritos con varios artistas favoritos cada uno
- **THEN** el chequeo procesa a todos y termina dentro del tiempo máximo de la función

### Requirement: Registrar como notificado solo tras enviar
El sistema SHALL marcar un lanzamiento como notificado únicamente después de enviarlo, de
modo que una ejecución interrumpida no descarte avisos pendientes.

#### Scenario: Ejecución interrumpida antes de enviar
- **WHEN** el chequeo se interrumpe antes de enviar los avisos de un usuario
- **THEN** esos lanzamientos permanecen pendientes y se avisan en la siguiente ejecución

### Requirement: Registro del token nativo por dispositivo
En la app nativa, la app SHALL registrar en el servidor el token FCM del dispositivo al
concederse el permiso, SHALL eliminarlo al desactivar las notificaciones, y SHALL
almacenarlo por dispositivo del mismo modo que las suscripciones web.

#### Scenario: Registro al conceder permiso
- **WHEN** la app nativa obtiene un token FCM tras concederse el permiso
- **THEN** la app lo envía al servidor y queda asociado al usuario y al dispositivo

#### Scenario: Baja al desactivar
- **WHEN** el usuario desactiva las notificaciones en la app nativa
- **THEN** el token de ese dispositivo se elimina del servidor

#### Scenario: Varios dispositivos nativos
- **WHEN** un mismo usuario activa notificaciones en dos dispositivos nativos
- **THEN** el servidor conserva un token por cada dispositivo

### Requirement: Entrega de notificaciones nativas mediante FCM
El servidor SHALL entregar las notificaciones a los tokens nativos registrados usando
Firebase Cloud Messaging HTTP v1, y SHALL eliminar los tokens que FCM reporte como no
registrados.

#### Scenario: Envío a tokens vigentes
- **WHEN** se genera una notificación para un usuario con tokens nativos registrados
- **THEN** el servidor envía el mensaje a cada token vigente

#### Scenario: Token no registrado
- **WHEN** FCM responde que un token ya no es válido
- **THEN** el servidor elimina ese token y continúa con los demás

### Requirement: Coherencia del proyecto FCM
La app nativa y el servidor SHALL usar la misma configuración de proyecto Firebase para
emitir y entregar los tokens FCM, de modo que un token generado por la app sea entregable
por el servidor.

#### Scenario: Token entregable
- **WHEN** la app nativa registra un token
- **THEN** el servidor puede entregar en él mensajes firmados por el mismo proyecto
