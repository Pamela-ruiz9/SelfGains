# Descubrimiento y conexiones entre usuarios — estado

Retoma el brainstorming que había quedado explícitamente diferido durante `docs/agents/rol-entrenador-status.md`: "cómo debería conectarse un usuario con otro" en general, más allá del código/link de invitación. Tres piezas: búsqueda por nombre + solicitudes de conexión, buscador de entrenadores con mapa, compartir rutinas entre pares. Spec y plan en `docs/superpowers/specs/2026-08-18-descubrimiento-y-conexiones-design.md` y `docs/superpowers/plans/2026-08-18-descubrimiento-y-conexiones.md` (11 tareas, ejecutadas con subagentes: implementador + revisión de spec + revisión de calidad por cada una, con rondas de corrección donde hizo falta, más un revisor holístico final sobre todo el diff).

## Completado (2026-08-18/19)

**Modelo de datos** (`supabase/schema.sql`)
- `public_identities` pasa de "solo conectados" a lectura abierta a cualquier usuario autenticado — es lo que habilita la búsqueda por nombre.
- `connection_requests` (solicitud pendiente con `unique(from_user_id, to_user_id)`) + RLS: el receptor decide (`accepted`/`rejected`), el remitente puede reactivar su propia fila a `pending` únicamente si estaba en `accepted` (reconectar tras desvincularse) — nunca desde `rejected`, un rechazo explícito queda definitivo.
- `trainer_profiles` (perfil de mapa: pin, visibilidad, disciplinas, bio, tarifa) — tabla física separada de `profiles`/`public_identities`, mismo principio de aislamiento por privacidad que ya se usaba.
- `routine_shares` (propuesta pendiente de compartir una rutina) + política nueva de `select` sobre `routines` acotada a propuestas `pending` dirigidas al receptor, para que pueda previsualizar antes de aceptar.
- Las tres tablas nuevas usan el patrón `revoke update on X from authenticated; grant update (status) on X to authenticated;` para que un usuario solo pueda tocar la columna `status` de una fila ajena — un `revoke` solo a nivel de columna no alcanza contra el `grant` de tabla completa que Supabase da por defecto (encontrado y corregido empíricamente contra el proyecto real).

**Código**
- `src/lib/connectionRequests.ts` (nuevo): `searchUsers` (con estado por resultado: conectado/solicitud enviada/solicitud recibida/nada), `getIncomingRequests`, `sendConnectionRequest`, `acceptConnectionRequest`, `rejectConnectionRequest`.
- `src/lib/trainerProfiles.ts` (nuevo): perfil de mapa propio, `getVisibleTrainersNear` (Haversine en cliente, sin PostGIS ni funciones RPC), con el mismo cálculo de estado de conexión que `searchUsers`.
- `src/components/react/Shared/MapPicker.tsx` (nuevo): wrapper de Leaflet reusable (pin arrastrable / marcadores de solo lectura), con import dinámico de Leaflet (evita romper el prerender SSR de Astro con `client:load`).
- `src/lib/routineShares.ts` (nuevo): proponer/previsualizar/aceptar/rechazar una rutina compartida — `acceptRoutineShare` deriva la rutina a copiar de una lectura verificada en la base, nunca de un parámetro del llamador.
- `src/components/react/Connections/Connections.tsx`: pantalla principal, ahora con seis secciones (link de invitación, código, búsqueda + solicitudes, buscador de entrenadores, rutinas compartidas pendientes, mis conexiones).
- Tarjeta "Buscador de entrenadores" en `ProfileForm.tsx`, botón "Compartir" en `RoutineList.tsx`, `RoutinePreview.tsx` (vista de solo lectura de días/ejercicios).

Commits: ver `git log --oneline ea4c0ad..04eb7da` (34 commits — 12 `feat`, 11 `fix`, 11 `docs` de sincronización del plan con cada corrección).

## Bugs reales encontrados y corregidos durante el desarrollo

Cada uno se encontró en revisión de código o en verificación E2E, no en producción:

1. **RLS de columna insuficiente** (Task 1): `revoke update (columna)` no alcanza contra el `grant` de tabla completa que Supabase da por defecto — hacía falta `revoke update` de tabla completa + `grant update (columna)` específica. Verificado empíricamente contra el proyecto real vía `information_schema.column_privileges`.
2. **Confianza en parámetro del llamador** (`acceptConnectionRequest`, `acceptRoutineShare`): ambas derivaban datos sensibles de un parámetro pasado por el cliente en vez de leerlo verificado de la base — permitía forjar conexiones o marcar la propuesta equivocada como aceptada. Corregido antes de que ninguna UI dependiera de la firma vieja.
3. **Un entrenador se veía a sí mismo** en su propio buscador y podía intentar "Conectar" consigo mismo (violaba el constraint `no_self`).
4. **Doble fetch por cada pan del mapa**: `MapPicker` re-disparaba `moveend` al sincronizar `center` de vuelta, duplicando la consulta de entrenadores cercanos.
5. **Solicitud de conexión sin salida** (encontrado en la verificación E2E final): reenviar una solicitud después de desvincularse quedaba descartado en silencio para siempre (política de RLS no dejaba tocar una fila ya resuelta). Primer fix demasiado amplio (dejaba revivir también desde `rejected`, anulando un rechazo explícito) — corregido a una segunda vuelta para que solo se pueda revivir desde `accepted`.
6. **Buscador de entrenadores no reusaba el flujo de estado de conexión** (encontrado en revisión holística final): mostraba "Conectar" sin importar si ya estabas conectado o tenías una solicitud pendiente con ese entrenador — corregido para que calcule el mismo estado que la búsqueda por nombre.

## Verificación hecha

- `npm run build && npx tsc --noEmit` limpio en cada tarea y cada fix (único error preexistente y no relacionado de `ProgressList.tsx`).
- Migración aplicada y verificada contra el proyecto Supabase real (`supabase db query --linked`), incluyendo verificación empírica de `information_schema.column_privileges` para el fix de RLS de columna.
- **Verificación manual E2E completa contra Supabase real**, dos cuentas de prueba reutilizadas (`crud-e2e-1786826288@gmail.com`, `rutinastest1786031687911@gmail.com`): descubrimiento por nombre, caso cruzado de solicitudes simultáneas, buscador de entrenadores (con fallback de geolocalización denegada), compartir rutina completo (ver/rechazar/aceptar, copia independiente confirmada). Encontró el bug #5 de arriba, que a su vez necesitó una segunda corrección verificada con un pase de Playwright específico (no una repetición de todo el E2E).

## Lo que falta / limitaciones conocidas (aceptadas explícitamente, no descuidos)

- **`acceptRoutineShare` no es atómico contra una carrera de dos pestañas/sesiones reales** (no solo doble click, que sí está bloqueado en la UI): el `insert` de la copia ocurre antes del `update` con guarda de idempotencia, así que dos llamadas genuinamente concurrentes pueden ambas insertar una copia antes de que la segunda falle en el paso final. Requeriría una transacción atómica (función RPC de Postgres) que el proyecto evita deliberadamente. Borde muy angosto, sin corrupción de datos (solo una copia de rutina huérfana en el peor caso), aceptado conscientemente en la revisión de Task 8.
- **`routine_shares` no tiene constraint único** como sí tiene `connection_requests` — se puede proponer la misma rutina al mismo destinatario más de una vez, creando propuestas duplicadas. Asimetría menor entre las dos tablas, no bloqueante.
- **`Connections.tsx` tiene 6 secciones/~650 líneas en un solo archivo** — funciona hoy (cada sección es su propio bloque de estado+handlers+JSX con acoplamiento mínimo entre sí, solo comparten `refresh()`), pero es el candidato natural a dividir en componentes hermanos (mismo patrón que `RoutineList.tsx`/`CreateRoutineForm.tsx` ya extraídos de `RoutineManager.tsx`) antes de agregarle una séptima funcionalidad.
- Manejo de errores no uniforme entre secciones: búsqueda/mapa de entrenadores usan el banner de error compartido arriba de la página; rutinas compartidas usa un error local a su propia sección (mejor UX ahí, pero inconsistente con el resto).
- **Brainstorming de descubrimiento genérico**: esta ronda cubre búsqueda por nombre + mapa de entrenadores + compartir rutinas, que era exactamente lo que había quedado pendiente. No queda ningún ítem de "cómo conectarse" sin abordar en `docs/roadmap-ideas.md`.

## Si se retoma

- Antes de sumar una séptima sección a `Connections.tsx`, extraer al menos el buscador de entrenadores y las rutinas compartidas pendientes a componentes hermanos propios.
- Si el borde de concurrencia de `acceptRoutineShare` importa en la práctica (uso multi-dispositivo real), la solución limpia requeriría relajar la restricción de "sin funciones RPC de Postgres" para esa única operación específica.
