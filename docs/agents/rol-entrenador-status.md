# Rol de entrenador + conexiones — estado

Cualquier usuario puede autodeclararse entrenador y conectarse con otro vía un link corto de invitación (consentimiento mutuo); una vez conectados, se ven mutuamente una identidad pública mínima (nombre, avatar, si es entrenador), y si uno de los dos es entrenador puede asignarle rutinas directamente al otro como copia de propiedad completa. Elegido del backlog de negocio (`docs/roadmap-ideas.md`). Spec y plan en `docs/superpowers/specs/2026-08-18-rol-entrenador-design.md` y `docs/superpowers/plans/2026-08-18-rol-entrenador.md`.

## Cambio de alcance a mitad de implementación

El diseño original incluía que cualquier usuario pudiera compartir su perfil/dashboard completo con otro por consentimiento mutuo (generalizando el vínculo entrenador↔alumno a conexiones genéricas). A mitad de implementación, un revisor de calidad de código encontró que la política de RLS propuesta para esto exponía la fila completa de `profiles` — incluidas las medidas corporales — a cualquier conexión, porque RLS es por fila, no por columna, y la UI solo pedía nombre/avatar/rol pero la política habilitaba leer todo. El usuario, al enterarse, cortó la capacidad de "compartir perfil" por completo en vez de acotar columnas, y pidió seguir implementando el resto mientras quedaba pendiente, como ronda aparte, un brainstorming sobre "cómo debería conectarse un usuario con otro" en general (búsqueda, descubrimiento, etc. — **no arrancado todavía**).

Lo que sobrevivió del alcance genérico: la conexión en sí (tabla simétrica `connections` + `invite_codes`) y una identidad pública mínima nueva, físicamente separada de `profiles` — la tabla `public_identities` (solo `display_name`, `avatar_url`, `is_trainer`), que es lo único que una conexión puede leer del otro lado. `profiles` completo sigue siendo estrictamente privado, sin ninguna política de RLS que lo exponga entre conexiones.

## Completado (2026-08-18)

**Modelo de datos** (`supabase/schema.sql`)
- `profiles.is_trainer` (autodeclaración), `routines.assigned_by_name` (leyenda de quién asignó la rutina).
- `invite_codes` (código corto por usuario, regenerable) e `connections` (par simétrico `user_a < user_b`, orden canónico verificado empíricamente contra `.sort()` de JS para que `unique(user_a, user_b)` detecte una conexión repetida sin importar quién redimió el código de quién).
- `public_identities` (tabla física separada, no una política de RLS sobre `profiles` — ver sección de arriba) + política de RLS que solo un usuario conectado puede leer.
- Política de RLS que permite a un entrenador conectado **insertar** (no leer) rutinas en la cuenta de un alumno conectado.
- Commits: `78df461` (migración inicial), `9616013` (nombres de política recortados al límite de 63 bytes de Postgres — un nombre en español con caracteres accentuados se trunca en silencio si se pasa), `3828919` (orden canónico del par), `8388d28` (reemplazo de la política sobre `profiles` completo por `public_identities`).

**Código**
- `src/lib/profile.ts`: `upsertProfile()` ahora espeja `display_name`/`avatar_url`/`is_trainer` a `public_identities` en cada guardado.
- `src/lib/connections.ts` (nuevo): generación/redención de código de invitación, listado de conexiones (lee de `public_identities`, nunca de `profiles`), desvincular.
- `src/lib/routines.ts`: `assignRoutineToStudent()` — copia de propiedad completa de una rutina propia a la cuenta de un alumno conectado.
- `src/components/react/Shared/Avatar.tsx` (nuevo): avatar reusable con distintivo de entrenador (★).
- `/c/#CODIGO` (`src/pages/c.astro` + `RedeemInvite.tsx`, nuevos): página de redención — el sitio es 100% estático, así que el código va en el fragmento hash, no en una ruta dinámica.
- `/conexiones/` (`src/pages/conexiones.astro` + `Connections.tsx`, nuevos): pantalla principal — generar/copiar/regenerar mi link, conectarme con un código, lista de conexiones, asignar rutina inline si soy entrenador.
- "Compartida por: X" en `RoutineList.tsx` para rutinas asignadas; tarjeta "Conexiones →" en Perfil.

## Verificación hecha

- `npm run build && npx tsc --noEmit` limpio en cada tarea, ejecutadas con subagentes (implementador + revisión de spec + revisión de calidad, con rondas de corrección donde hizo falta) + un revisor holístico final sobre todo el diff de la rama antes de mergear.
- **Verificación manual E2E contra Supabase real**, dos cuentas de prueba (`crud-e2e-1786826288@gmail.com` + `rutinastest1786031687911@gmail.com`, reactivada de una sesión anterior). Encontró y corrigió un bug real:

### Bug real encontrado: pedir `RETURNING` sobre una fila que el entrenador no puede leer

`assignRoutineToStudent` encadenaba `.insert({...}).select().single()`. El INSERT en sí pasa la política de RLS de entrenador conectado sin problema — verificado insertando directo por REST con el JWT real de la cuenta A, con y sin el header `Prefer: return=representation`: sin el header, `201` limpio; con el header (lo que hace `.select()` de supabase-js), `403` con el mismo mensaje genérico de violación de RLS. La causa real: Postgres exige que la fila recién insertada también pase la política de **SELECT** de la tabla para poder devolverla en el `RETURNING`, y un entrenador legítimamente no puede leer el resto de rutinas del alumno (por diseño). El mensaje de error es indistinguible del de un INSERT rechazado de verdad, así que dos revisores leyeron la política de INSERT, la razonaron correcta (lo era) y no vieron el bug — solo apareció al ejercitar el flujo real. Fix: se sacó `.select()` (nada consumía el valor de retorno) y la firma pasó de `Promise<Routine>` a `Promise<void>`. Commit `a1c605e`. Detalle completo de cómo diagnosticarlo en `docs/agents/notas-de-entorno-y-lecciones.md`.

Re-verificado end-to-end después del fix: asignación funciona, el alumno ve "Compartida por: tu entrenador" en `/rutinas/`, puede editar el nombre, y el entrenador sigue sin poder leer la rutina del alumno (la política de lectura funciona exactamente como se diseñó).

## Lo que falta / limitaciones conocidas

- **Brainstorming pendiente, explícitamente diferido**: "cómo debería conectarse un usuario con otro" en general (descubrimiento/búsqueda de entrenadores, más allá del código de invitación actual) — no arrancado.
- Reasignar una rutina que ya se recibió de otro entrenador sobreescribe `assigned_by_name` en silencio, descartando la cadena de procedencia original — consistente con "copia, no referencia", pero no está explícitamente decidido en el spec.
- Sin suite de tests automatizada (consistente con el resto del proyecto).
