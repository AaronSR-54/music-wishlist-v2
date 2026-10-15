# Play Console — Contenido de la app y configuración inicial

Guía con la respuesta recomendada para cada campo de la pantalla *Contenido de la
app* y de la *Configuración de la ficha de Play Store*.

> **Importante:** la Play Developer API **no** expone ninguna de estas
> declaraciones (Data safety, clasificación de contenido, audiencia, anuncios,
> acceso, política de privacidad, categoría). Solo son automatizables la ficha
> (texto + gráficos, ya hecha) y los **datos de contacto + idioma por defecto**
> (`edits.details`). Todo lo de este documento se rellena **a mano en Play
> Console**.

App: **Music Wishlist** · Paquete: `com.musicwishlist.app`
Web: <https://music-wishlist-v2.vercel.app> · Privacidad: <https://music-wishlist-v2.vercel.app/privacy.html>

---

## 1. Datos de inicio de sesión (App access)

La app requiere **iniciar sesión con Google** para usar sus funciones.

- Opción: **Todas o algunas funcionalidades no están disponibles sin credenciales**.
- Instrucciones: crea una **cuenta de prueba de Google** dedicada a la revisión
  (por ejemplo `review@…`) y facilita email y contraseña en el campo de
  instrucciones. El revisor entra con ella y ve la app completa (lanzamientos,
  buscador, wishlist y perfil).
  - Pasos a indicar: 1) abrir la app; 2) tocar **Continuar con Google**;
    3) introducir la cuenta de prueba; 4) navegar por todas las secciones.

> El modo demo (`?demo`) no sirve para la revisión: al ser una TWA no se puede
> añadir el parámetro a la URL, por eso se entrega una cuenta de prueba real.

## 2. Anuncios

- ¿Tu app contiene anuncios? → **No, mi app no contiene anuncios**.

## 3. Clasificación de contenido

Rellena el cuestionario de **IARC** (Play Console → Contenido de la app →
Clasificación de contenido).

- Categoría: **Música y audio** / aplicación.
- No hay contenido violento, sexual, de juego, apuestas, drogas, etc.
- **Interacción entre usuarios: SÍ** (compartir listas + notificaciones push).
- **Compras digitales: No**. **Anuncios: No**. **Comparte ubicación: No**.
- Responder con veracidad; se obtendrá una clasificación (por ejemplo *PEGI 3 /
  Todos*) aplicable a todos los territorios.

## 4. Audiencia objetivo y contenido

- Grupos de edad: **13–15, 16–17, 18+** (app de música general; evita <13 para no
  entrar en COPPA/Familias).
- ¿La app atrae a niños sin querer? → **No**.
- ¿Anuncios mostrados a niños? → **No**.

> Si quieres apuntar a menores de 13, entra en el programa **Diseñada para
> Familias** y sus requisitos; no es lo recomendado aquí.

## 5. Seguridad de los datos (Data safety)

> Requiere además una **URL de eliminación de datos** y una **política de
> privacidad** públicas.

- ¿Recopila o comparte datos de usuario? → **Sí**.
- ¿Todos los datos están cifrados en tránsito? → **Sí** (HTTPS).
- ¿Ofreces una forma de solicitar la eliminación de datos? → **Sí**.
- **URL de eliminación de datos**: `https://music-wishlist-v2.vercel.app/delete-account.html`
- Eliminación **in-app**: Perfil → *Eliminar cuenta* (borra los datos y la cuenta).

Tipos de datos recomendados (recopilados, no compartidos salvo lo indicado):

| Categoría | Tipo | ¿Recopilado? | ¿Compartido? | Propósito | Obligatorio |
|-----------|------|--------------|--------------|-----------|-------------|
| Información personal | Nombre | Sí | No | Gestión de cuenta | Sí |
| Información personal | Dirección de correo | Sí | No | Gestión de cuenta · Funcionalidad | Sí |
| Información personal | Correo de terceros (compartir/invitar) | Sí | No | Funcionalidad | Opcional |
| Identificadores | ID de usuario | Sí | No | Gestión de cuenta | Sí |
| Identificadores | ID de dispositivo/otros (token push) | Sí | No | Funcionalidad (notificaciones) | Opcional |
| Actividad en la app | Contenido de la lista (wishlist, favoritos) | Sí | No | Funcionalidad | Sí |
| Actividad en la app | Términos de búsqueda | Sí | **Sí** (Deezer) | Funcionalidad | Opcional |

No se recopilan: ubicación, contactos del dispositivo, calendario, SMS, fotos,
audio, archivos, salud, finanzas, historial de navegación ni ID de publicidad.

## 6. Aplicaciones gubernamentales

- ¿Es una app gubernamental? → **No**.

## 7. Funciones financieras

- ¿Ofrece productos o servicios financieros? → **No**.

## 8. Salud

- ¿Es una app de salud? → **No**.

## 9. Configuración de la ficha (categoría y contacto)

- **Categoría de la app**: *Música y audio*.
- **Etiquetas**: opcional.
- **Datos de contacto** (ya aplicados vía API con `play.mjs details`):
  - **Email**: `aaronsanzroca@gmail.com`
  - **Sitio web**: `https://music-wishlist-v2.vercel.app`
  - **Teléfono**: vacío (opcional).
- **Política de privacidad**: `https://music-wishlist-v2.vercel.app/privacy.html`
- **Eliminación de datos** (Data safety): `https://music-wishlist-v2.vercel.app/delete-account.html`

## 10. Ficha de Play Store

El texto localizado (en-US / es-ES), el icono, el gráfico destacado y las
capturas por idioma ya están aplicados con el comando `listing` de la skill
`google-play-console` (ver `store/README.md`).

---

## Pendientes (pasos manuales en Play Console)

- **Cuenta de prueba de Google**: crear la cuenta para el revisor (paso manual).
- **Rellenar en Play Console** cada declaración de la checklist (no tienen API).

> Los **datos de contacto** (email `aaronsanzroca@gmail.com` + web) ya están
> aplicados vía API con `play.mjs details`.
