# Spec Delta

## ADDED Requirements

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
