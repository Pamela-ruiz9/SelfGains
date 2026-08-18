# Logueo offline + sincronización — estado

Permite seguir registrando entrenamientos (crear, editar, borrar sets y sesiones) sin conexión, sincronizando solo con Supabase al reconectar — sin perder datos y sin pisar en silencio un cambio hecho desde otro dispositivo. Spec 2 de la serie de mejoras técnicas, construida sobre el service worker de app-shell que dejó `docs/agents/pwa-instalable-status.md` (spec 1). Spec y plan en `docs/superpowers/specs/2026-08-16-logueo-offline-y-sync-design.md` y `docs/superpowers/plans/2026-08-16-logueo-offline-y-sync.md`.

## Completado (2026-08-16)

**Modelo de datos**
- `workout_sets`/`workout_sessions` ganaron `updated_at` + trigger, base para la detección de conflictos. Commit `a77ac8d`.
- IndexedDB (`idb`) como caché local + cola de escrituras pendientes: `src/lib/offlineDb.ts` (schema, migración, transacciones atómicas de lectura-modificación-escritura — corregido de no-atómico a atómico en `6d661f9`), `src/lib/offlineQueue.ts` (cola + caché). Commits `a1656b7`, `d41cc1d`, `22ba6d3` (reintento de apertura de IndexedDB tras una conexión rechazada).

**Código**
- `src/lib/workouts.ts` offline-aware: crear/editar/borrar sets, sesiones y entrenamientos encolan si no hay red, con detección de conflicto si el servidor cambió mientras había una edición offline pendiente. Commit `5d1eac1`, con correcciones de migración de caché, coalescencia de ediciones offline repetidas, y cancelación de dependientes huérfanos en `88abe0d`.
- Caché de la rutina activa para arranques en frío offline (abrir la app ya sin red sigue mostrando el último dato conocido). Commit `40fe974`.
- `SyncBanner` global + refresco de UI tras sincronizar en segundo plano. Commit `be6ab33`.
- Pantalla de resolución de conflictos (`ConflictResolution.tsx`) cuando el mismo set/sesión fue editado en el servidor mientras había un cambio offline pendiente — resolución manual, nunca se pisa en silencio. Commit `23eeb0b`, con corrección de nombres de campo y cobertura de descarte en `8c2711c`.
- Protección contra `flushQueue()` corriendo dos veces en paralelo y duplicando el procesamiento de la cola. Commit `b803357`.

## Verificación hecha

- `npm run build && npx tsc --noEmit` limpio en cada tarea, subagentes (implementador + revisión de spec + revisión de calidad).
- Verificación manual con Playwright contra `astro build && astro preview` y la base Supabase real (nunca mock). Encontró y corrigió bugs reales de detección offline y refresco en vivo (`8422b55`) y brechas finales en la revisión holística (`6653556`) — no solo "build limpio", sino comportamiento real ejercitado offline/online.
- `postgrest-js` reintenta GETs 3 veces con backoff exponencial por defecto (~20s antes de caer al caché offline) — se agregó `.retry(false)` a las lecturas relevantes (`getWorkoutsRemote`, `getSetsRemote`, `getSessionsRemote`, `getActiveRoutine`) ya que solo `GET/HEAD/OPTIONS` son reintentables, sin afectar escrituras.

## Lo que falta / limitaciones conocidas

Documentado como explícitamente fuera de esta ronda, y luego cubierto por spec 3 (ver `docs/agents/offline-sync-hardening-status.md`):
- Refresco de sesión offline (JWT cacheado vencido durante mucho tiempo sin red).
- Cuota de IndexedDB excedida.
- Coordinación entre pestañas del mismo origen offline a la vez.

Sigue fuera de alcance (no planeado): multi-dispositivo en tiempo real / colaboración — la app es de un solo usuario por cuenta, el único escenario de conflicto contemplado es el mismo usuario en dos dispositivos offline a la vez.
