# Perfil y personalización — estado

Página `/perfil/`: foto, nombre, medidas corporales, tema claro/oscuro y color de acento personalizable, cierre de sesión. No tiene spec/plan formal en `docs/superpowers/` — se construyó directo a partir de un pedido conversacional, no de un proceso spec-driven.

## Completado (2026-08-15)

**Por qué existe la página**
El usuario pidió reordenar el nav para que "Registrar" quede en el centro en forma circular, y de paso pidió que el detalle de usuario (foto, nombre, peso, estatura, medidas) viviera en la nueva posición de "Perfil" al final del nav. Un solo pedido generó tres features encadenadas: reorden de nav, página de perfil, y tema personalizable (este último fue una pregunta de seguimiento del usuario, no parte del pedido original).

**Modelo de datos**
- Tabla `profiles` (`user_id` PK, `display_name`, `avatar_url`, medidas corporales) — upsert por usuario.
- Tabla `measurements` (`user_id`, `date`, campos de medida) — una fila por usuario+fecha, para poder graficar historial (ver `docs/agents/progreso-graficas-prs-status.md`, sección "Rediseño completo").
- Bucket de Storage `avatars`, RLS por prefijo `{user_id}/...`, subida siempre a la misma ruta (`{user_id}/avatar.<ext>`, `upsert: true`) para que una foto nueva pise la anterior en vez de acumular archivos huérfanos.

**Código**
- `src/lib/profile.ts` — `getMyProfile`/`upsertProfile`/`uploadAvatar`.
- `src/lib/measurements.ts` — `getMyMeasurements`/`logMeasurement`.
- `src/lib/theme.ts` — `applyTheme(theme, accentColor)`, persistido en `localStorage` (`selfgains-theme`, `selfgains-accent`), acento por defecto `#d7ff3f`.
- `src/components/react/Profile/ProfileForm.tsx` — el formulario completo: foto, nombre, medidas, selector de tema/acento, banner de recordatorio si la rutina activa venció, botón de logout.
- `src/pages/perfil.astro`.

**Theming en vivo (toda la app, no solo Perfil)**
- Claro/oscuro: bloque `:root[data-theme="light"]` en `src/styles/global.css` que redefine `--color-ink/surface/surface-raised/paper/paper-dim` — cada componente ya leía estos tokens por nombre, así que no hubo que tocar componente por componente.
- Acento personalizable: `--color-acid` se pisa por usuario vía JS (no es parte del bloque de tema claro/oscuro, es independiente).
- Token nuevo `--color-on-accent`: texto sobre un fill de acento (ej. texto de `btn-brutal`) necesita quedar oscuro **sin importar el tema ni el acento elegido** — si el acento cambia a un color oscuro, el texto sobre él no puede seguir la regla normal de "texto = paper". Se aisló ese único caso en un token separado en vez de intentar que ink/paper cubrieran también ese rol.
- FOUC evitado con un script síncrono `is:inline` en el `<head>` de `BaseLayout.astro`, que lee `localStorage` y aplica tema/acento **antes** del primer paint.

**Auto-completado desde Google (2026-08-15, commit `c9c36b4`)**
- Si el usuario inició sesión con Google y todavía no tiene foto/nombre propios en `profiles`, se auto-completan con los metadatos de la cuenta de Google (`user.user_metadata.avatar_url`/`full_name`).
- Regla importante: **es un default, no un override.** Si el usuario ya había elegido su propia foto o nombre, Google nunca los pisa — el chequeo es "¿el campo está vacío?", no "¿existe una cuenta de Google conectada?".

Commits: `cc56322` (nav + Perfil + theming), `c9c36b4` (auto-completado de Google), `78d1a51` (tabla `measurements` y su UI, aunque expuesta en `/progreso/` — ver ese doc).

## Verificación hecha

- `npm run build` limpio.
- Smoke test manual vía Playwright: cambiar tema claro/oscuro y confirmar que persiste tras recargar; cambiar el color de acento y confirmar que se propaga a botones/nav/gráficas sin recargar; subir una foto y confirmar que reemplaza (no duplica) el archivo en Storage; loguear con Google y confirmar que el nombre/foto se auto-completan solo si estaban vacíos.

## Lo que falta / limitaciones conocidas

- Sin borrar la cuenta desde la UI (solo logout).
- Sin recorte/ajuste de la foto subida — se sube tal cual, sin crop.
- El acento personalizable no valida contraste — un usuario podría elegir un color casi ilegible sobre `--color-on-accent` fijo y no hay aviso.
- Medidas corporales: sin unidades configurables (todo en las unidades que ya usaba la app — kg/cm), sin historial editable/borrable fila por fila (solo se puede loguear una nueva medida, no corregir una vieja).

## Si se retoma

- El patrón de auto-completado "solo si está vacío" en `ProfileForm.tsx` es el lugar a mirar si se agrega otro proveedor OAuth (ej. Apple) con la misma lógica de default-no-override.
- Si se agrega más de un color de acento por tema (uno para claro, otro para oscuro), `theme.ts` hoy asume un solo `selfgains-accent` global — habría que decidir si el acento es por-tema o global antes de tocar el modelo de storage.