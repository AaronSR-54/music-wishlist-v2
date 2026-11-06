# Spec Delta

## MODIFIED Requirements

### Requirement: Suscripción a notificaciones desde la app
La app SHALL permitir al usuario activar y desactivar las notificaciones desde Perfil en el
navegador y SHALL reflejar su estado real en la interfaz. En la app nativa no SHALL existir un
interruptor propio: el permiso lo gestiona Android y la app SHALL registrar el dispositivo
automáticamente en cuanto el permiso esté concedido.

#### Scenario: Activación exitosa
- **WHEN** el usuario pulsa "Activar notificaciones" en el navegador y concede el permiso
- **THEN** la app crea una suscripción Web Push y la muestra como activada

#### Scenario: Permiso denegado
- **WHEN** el usuario pulsa "Activar notificaciones" en el navegador y el navegador deniega el permiso
- **THEN** la app muestra un aviso de permiso bloqueado y no deja la suscripción como activa

#### Scenario: Contexto sin soporte
- **WHEN** el dispositivo no soporta Web Push
- **THEN** la app indica que las notificaciones no están soportadas en lugar de mostrar el botón

#### Scenario: Activación en el app nativo
- **WHEN** el usuario abre la app nativa con el permiso de notificaciones concedido
- **THEN** la app registra el dispositivo automáticamente, sin que el usuario active nada en Perfil

#### Scenario: Permiso nativo denegado
- **WHEN** el usuario deniega el permiso de notificaciones en la app nativa
- **THEN** la app no deja las notificaciones como activas y ofrece la vía de los ajustes del sistema

#### Scenario: Sin interruptor en la app nativa
- **WHEN** el usuario abre Perfil en la app nativa
- **THEN** no aparece un control para activar o desactivar las notificaciones

### Requirement: Estado de notificaciones visible
La app SHALL reflejar en Perfil si las notificaciones están soportadas, si el permiso está
concedido o bloqueado y el estado de la suscripción del dispositivo. En el navegador SHALL ofrecer
el botón de activación o desactivación. En la app nativa SHALL ofrecer únicamente una acción que
abra los ajustes de notificaciones de Android, disponible con independencia del estado del permiso.

#### Scenario: Estado visible
- **WHEN** el usuario abre Perfil
- **THEN** la app muestra si las notificaciones están soportadas o bloqueadas y el estado de la
  suscripción del dispositivo

#### Scenario: Estado visible en el navegador
- **WHEN** el usuario abre Perfil en el navegador
- **THEN** la app ofrece un botón para activarlas o desactivarlas según el estado de la suscripción

#### Scenario: Estado visible en la app nativa
- **WHEN** el usuario abre Perfil en la app nativa
- **THEN** la app muestra una acción para abrir los ajustes de notificaciones de Android sin ofrecer
  un control para activarlas o desactivarlas

#### Scenario: Permiso denegado en la app nativa
- **WHEN** el usuario abre Perfil en la app nativa con el permiso de notificaciones denegado
- **THEN** la app sigue mostrando la misma acción que abre los ajustes de notificaciones de Android
  para esa app

### Requirement: Registro del token nativo por dispositivo
En la app nativa, la app SHALL registrar en el servidor el token FCM del dispositivo al concederse
el permiso o al autenticarse el usuario, SHALL eliminarlo del servidor cuando el permiso deje de
estar concedido, y SHALL almacenarlo por dispositivo del mismo modo que las suscripciones web.

#### Scenario: Registro al conceder permiso
- **WHEN** la app nativa obtiene un token FCM tras concederse el permiso
- **THEN** la app lo envía al servidor y queda asociado al usuario y al dispositivo

#### Scenario: Baja al desactivar
- **WHEN** el permiso de notificaciones de la app nativa deja de estar concedido
- **THEN** la app elimina del servidor el token de ese dispositivo en cuanto puede autenticarse

#### Scenario: Varios dispositivos nativos
- **WHEN** un mismo usuario activa notificaciones en dos dispositivos nativos
- **THEN** el servidor conserva un token por cada dispositivo

#### Scenario: Registro al iniciar sesión
- **WHEN** el usuario inicia sesión en la app nativa con el permiso ya concedido
- **THEN** la app registra el token del dispositivo sin intervención del usuario

## ADDED Requirements

### Requirement: Solicitud del permiso al primer arranque
En la app nativa, la app SHALL solicitar el permiso de notificaciones de Android en el primer
arranque tras la instalación, SHALL registrarse si el usuario lo concede, y MUST NOT volver a
solicitarlo automáticamente después de una denegación.

#### Scenario: Primer arranque
- **WHEN** el usuario abre la app nativa por primera vez tras instalarla
- **THEN** el sistema muestra la solicitud de permiso de notificaciones de la app

#### Scenario: Permiso concedido en el primer arranque
- **WHEN** el usuario concede el permiso en esa primera solicitud
- **THEN** la app registra el dispositivo y queda lista para recibir notificaciones

#### Scenario: Segunda apertura tras denegar
- **WHEN** el usuario denegó el permiso y vuelve a abrir la app
- **THEN** la app no vuelve a mostrar la solicitud del sistema

#### Scenario: Permiso concedido desde los ajustes de Android
- **WHEN** el usuario concede el permiso desde los ajustes de Android y vuelve a la app
- **THEN** la app detecta el permiso al reanudarse y registra el dispositivo

#### Scenario: Android anterior a 13
- **WHEN** el dispositivo ejecuta una versión de Android que no solicita el permiso de notificaciones
- **THEN** la app registra el dispositivo sin mostrar ninguna solicitud

### Requirement: Canal de notificaciones de Android
La app nativa SHALL publicar las notificaciones de lanzamientos en un canal de notificaciones
propio de Android, y el servidor SHALL dirigir a ese canal los mensajes FCM de lanzamientos.

#### Scenario: Canal disponible
- **WHEN** la app nativa termina de arrancar en Android 8 o superior
- **THEN** el canal de notificaciones de lanzamientos existe con el nombre, la importancia y el
  sonido definidos por la app

#### Scenario: Lanzamiento entregado por el canal
- **WHEN** el servidor envía el aviso FCM de un lanzamiento
- **THEN** el mensaje indica el canal de la app y la notificación aparece bajo ese canal en Android
