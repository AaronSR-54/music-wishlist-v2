# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
