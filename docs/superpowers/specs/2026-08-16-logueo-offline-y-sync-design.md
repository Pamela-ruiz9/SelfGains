# Logueo offline + sincronización — diseño

Spec 2 de la serie de mejoras técnicas de esta sesión. Quedó explícitamente fuera de `docs/superpowers/specs/2026-08-16-pwa-instalable-y-fluidez-design.md` (spec 1) por ser un subsistema grande aparte, y se construye sobre el service worker de app-shell que ese spec dejó instalado.

**Pedido:** poder seguir registrando entrenamientos (crear, editar, borrar sets y sesiones) sin conexión, y que se sincronice solo con Supabase al reconectar, sin perder datos y sin pisar en silencio un cambio hecho desde otro dispositivo.

**Alcance:**
- Crear entrenamientos, sets y sesiones offline (`WorkoutLogger.tsx`).
- Editar y borrar sets/sesiones/entrenamientos ya guardados, offline (`WorkoutHistory.tsx` en `ProgressList`).
- Arranque en frío offline: abrir la app ya sin conexión (no solo perder la red a mitad de sesión) sigue mostrando el último dato conocido (entrenamientos pasados, rutina activa) para que sugerencias, "hoy toca" y "copiar un día anterior" sigan funcionando.
- Detección de conflictos cuando el mismo set/sesión fue editado en el servidor mientras había un cambio offline pendiente, con resolución manual del usuario (no se pisa en silencio).

**Explícitamente fuera de esta ronda:**
- Multi-dispositivo en tiempo real / colaboración (esta app es de un solo usuario por cuenta; el único escenario de conflicto contemplado es el mismo usuario en dos dispositivos offline a la vez).
- Refresco de token de sesión offline (ver límites, sección 5).
- Manejo de cuota de almacenamiento excedida en IndexedDB.
- Coordinación entre pestañas del mismo origen abiertas a la vez.
- Cualquier ítem del backlog de negocio en `docs/roadmap-ideas.md`.

## Enfoque técnico elegido

**Cola de escritura app-level sobre IndexedDB**, intercalada en `src/lib/workouts.ts` sin cambiar su API pública — cero cambios en los componentes que la consumen (`WorkoutLogger.tsx`, `WorkoutHistory.tsx`). Se usa el paquete `idb` (~3kb) como wrapper delgado sobre la API nativa de IndexedDB, en línea con cómo el repo ya suma dependencias chicas y justificadas en vez de reinventarlas (`recharts`, `three-bvh-csg`).

Se descartó **Background Sync API** del service worker — es el mecanismo "nativo" de la plataforma para reintentar requests en segundo plano, pero **Safari/iOS no lo soporta en absoluto**, y el spec 1 ya invierte específicamente en que iOS funcione bien (hint de instalación manual porque iOS tampoco dispara `beforeinstallprompt`). Depender de Background Sync dejaría sin sincronización automática a una porción grande de usuarios en el mismo dispositivo que el spec 1 ya trata como ciudadano de primera clase.

**Detección de "estoy offline":** no se pre-chequea `navigator.onLine` antes de intentar — es un flag conocido por dar falsos positivos (wifi conectado sin internet real). Cada función de `lib/workouts.ts` intenta la llamada real a Supabase primero, y solo cae a la cola si el intento falla con un error de red (no si falla por un error de validación/permiso, que debe seguir propagándose tal cual hoy). El reintento de la cola se dispara con el evento `online` del navegador y al montar la app si `navigator.onLine` es `true`.

## Arquitectura

```
WorkoutLogger.tsx / WorkoutHistory.tsx
        │  (llaman createWorkout, addSet, updateSet, deleteSet, ...)
        ▼
src/lib/workouts.ts          ← misma API pública que hoy
        │  cada función: intenta Supabase → si falla por red, delega a...
        ▼
src/lib/offlineQueue.ts      ← IndexedDB: cola de operaciones pendientes + caché de lectura
        │
        ▼ (al reconectar / abrir la app)
   flushQueue() → reproduce la cola contra Supabase, en orden
```

Piezas nuevas:
- **`src/lib/offlineDb.ts`** — abre la base IndexedDB `selfgains-offline` (versión 1) vía `idb`, expone los 3 object stores (`cache`, `queue`, `conflicts`).
- **`src/lib/offlineQueue.ts`** — lógica de negocio: encolar operaciones, `flushQueue()`, remapeo de ids temporales, detección de conflictos.
- **`src/lib/workouts.ts`** (modificado, no reescrito) — cada función intenta la llamada real primero; solo delega a la cola si el error es de red.
- **`src/components/react/SyncBanner/SyncBanner.tsx`** — banner global, montado en `BaseLayout.astro` (a diferencia del `InstallPrompt` del spec 1, que es por página, porque un cambio pendiente puede originarse en Registrar o en Progreso).
- **`src/pages/sincronizacion.astro`** (o sección dentro de Perfil — a definir en el plan de implementación) — pantalla de resolución de conflictos.

## 1. Migración: `updated_at` para detección de conflictos

`workout_sets` y `workout_sessions` solo tienen `created_at` hoy. Se agrega `updated_at`, con trigger para que ningún `UPDATE` futuro se olvide de bumpearlo:

```sql
alter table workout_sets add column updated_at timestamptz not null default now();
alter table workout_sessions add column updated_at timestamptz not null default now();

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workout_sets_set_updated_at before update on workout_sets
  for each row execute function set_updated_at();
create trigger workout_sessions_set_updated_at before update on workout_sessions
  for each row execute function set_updated_at();
```

`workouts` no lo necesita: no existe `updateWorkout()` (solo `deleteWorkout()`), y ese caso ("el workout padre se borró en el servidor mientras había un cambio hijo en cola") se detecta distinto según el tipo de operación — ver punto 7 de la sección 3.

## 2. Esquema de IndexedDB

Base `selfgains-offline`, versión 1, 3 object stores:

**`cache`** — snapshot de la última lectura exitosa por clave (`pastWorkouts`, `activeRoutine`). Se pisa entero cada vez que la lectura real a Supabase tiene éxito; se lee como fallback cuando esa lectura falla por red. Sin expiración — siempre es mejor mostrar el último dato conocido que nada. Las actividades/rutinas predefinidas (`activities`, `plans`) no necesitan store propia: ya vienen embebidas en el HTML estático de la página (Astro content collections en build time), que el service worker del spec 1 ya cachea.

**`queue`** — operaciones pendientes, en orden de inserción (key autoincremental = orden de reproducción):

```ts
interface QueueItem {
  id: number;                 // autoincrement, define el orden
  type: 'createWorkout' | 'addSet' | 'addSession'
      | 'updateSet' | 'deleteSet' | 'updateSession' | 'deleteSession'
      | 'deleteWorkout';
  payload: Record<string, unknown>;
  tempId?: string;            // id local (crypto.randomUUID()) si esta op crea algo
  dependsOnTempId?: string;   // ej. el addSet de un workout creado offline
  snapshotUpdatedAt?: string; // para updateSet/updateSession: updated_at visto al editar
  createdAt: string;
}
```

**`conflicts`** — operaciones que no se pudieron reproducir por conflicto, esperando decisión del usuario:

```ts
interface ConflictItem {
  id: number;
  queueItem: QueueItem;
  serverSnapshot: Record<string, unknown> | null; // null = la fila ya no existe
  detectedAt: string;
}
```

## 3. Cola de escritura y reproducción

**Crear algo offline** (`createWorkout`, `addSet`, `addSession`): la función genera un `tempId` local (`crypto.randomUUID()`), agrega el item a `queue`, y devuelve al componente un objeto optimista con ese `tempId` como `id` — así el componente sigue funcionando igual (lo muestra en la UI y, si hace falta, lo usa como `workoutId` en el siguiente `addSet`). Si `addSet`/`addSession` reciben un `workoutId` que es en realidad un `tempId` todavía no sincronizado, el item de cola guarda `dependsOnTempId` en vez de un id real.

**Editar/borrar algo offline** (`updateSet`, `deleteSet`, `updateSession`, `deleteSession`, `deleteWorkout`):
- Si el `id` es un `tempId` (la fila nunca llegó al servidor): la operación se aplica **directamente sobre el item ya encolado**, sin agregar uno nuevo — editar algo que nunca salió del dispositivo no necesita otro viaje al servidor; borrarlo simplemente saca ese `createX` de la cola.
- Si el `id` es real (fila sincronizada antes): se encola una operación `updateSet`/`deleteSet`/etc. normal, con `snapshotUpdatedAt` = el `updated_at` que la fila tenía en `cache` al momento de editar.

**`flushQueue()`** — se dispara en el evento `online` del navegador y al montar `BaseLayout` si `navigator.onLine` es `true`. Recorre `queue` en orden; por cada item:

1. Si depende de un `tempId` aún no resuelto a un id real, se detiene ahí — el resto de la cola espera al próximo intento.
2. Ejecuta la llamada real a Supabase con el id real ya resuelto.
3. **Éxito en un `create`:** guarda el mapeo `tempId → id real` en memoria (dura lo que dura este flush) para resolver los siguientes items dependientes; actualiza `cache`; saca el item de `queue`.
4. **Éxito en `update`/`delete`:** saca el item de `queue`; actualiza `cache`.
5. **Falla por red:** aborta todo el flush (seguimos offline en verdad); `queue` queda intacta para el próximo intento.
6. **Falla por conflicto** (ver sección 4): mueve el item a `conflicts`; sigue con el resto de la cola — un conflicto no bloquea todo.
7. **Falla porque el padre ya no existe** (un `deleteWorkout` ajeno se llevó por delante — cascade — las filas hijas): dos formas de detectarlo según el tipo de operación, mismo tratamiento final. Un `addSet`/`addSession` (`INSERT`) contra un `workout_id` que ya no existe falla con una violación de FK — error directo de Postgres. Un `updateSet`/`deleteSet`/etc. (`UPDATE`/`DELETE`) contra una fila que el cascade ya borró simplemente afecta 0 filas — mismo camino que un conflicto de `updated_at` (paso 6), que al hacer el fetch de verificación devuelve `null`. En ambos casos el item se mueve a `conflicts` con `serverSnapshot: null`.

## 4. Detección de conflictos y resolución

**Detección:** el propio `UPDATE`/`DELETE` es el chequeo atómico — se condiciona por `updated_at`, sin un fetch aparte antes (evitaría la condición de carrera entre "leer para comparar" y "escribir"):

```ts
const { data, error } = await supabase
  .from('workout_sets')
  .update({ reps, weight, rpe })
  .eq('id', setId)
  .eq('updated_at', snapshotUpdatedAt)
  .select();

if (!error && data.length === 0) {
  // 0 filas afectadas: cambió el updated_at (conflicto) o la fila ya no existe (borrada)
  const current = await supabase.from('workout_sets').select('*').eq('id', setId).maybeSingle();
  // current.data === null  → fila borrada en el servidor
  // current.data !== null  → conflicto real: mostrar current.data vs. el payload local
}
```

Mismo patrón para `deleteSet`/`updateSession`/`deleteSession` (el `delete` también lleva `.eq('updated_at', snapshotUpdatedAt)`).

**UI de resolución** (`/sincronizacion/`, linkeada desde el banner cuando hay conflictos): por cada conflicto se muestra:
- Qué cambiaste vos (el payload local — ej. "12 reps × 80kg").
- Qué hay en el servidor ahora (`serverSnapshot`).
- **"Mantener el mío"** — reintenta el `update` pisando el `updated_at` actual del servidor, sin condición.
- **"Descartar y usar el del servidor"** — borra el item de `conflicts`, refresca `cache` con el dato del servidor.
- Caso especial `serverSnapshot: null` ("este entrenamiento ya no existe"): solo botón "Descartar mi cambio".

## 5. Indicador global y límites conocidos

**`SyncBanner`** en `BaseLayout.astro`:
- `queue` no vacía y `conflicts` vacía → *"N cambios pendientes de sincronizar"*.
- `conflicts` no vacía → *"N conflictos — revisar"* (prioridad sobre el mensaje anterior).
- Ambas vacías → banner oculto. No hay mensaje persistente de "todo sincronizado" — mismo patrón discreto que el banner de instalación del spec 1, no ruido constante.

**Límites documentados, no resueltos con más ingeniería (YAGNI):**
- **Sesión expirada offline:** si el JWT cacheado expira mientras el dispositivo lleva mucho tiempo sin red (>1h típico), `flushQueue` falla por auth en vez de por red — se trata igual que "sin red" (la cola espera), pero el usuario va a necesitar volver a loguearse la próxima vez que abra la app con conexión para que el flush arranque. No se intenta refrescar el token offline.
- **Cuota de IndexedDB:** dado el volumen de datos de esta app (texto, sin imágenes), no se espera acercarse a los límites del navegador; no se maneja cuota excedida en esta ronda.
- **Multi-pestaña:** si el usuario tiene la app abierta en dos pestañas offline a la vez, ambas escriben a la misma IndexedDB — comportamiento nativo del navegador, sin coordinación extra.

## Testing

Sin suite automatizada (consistente con el resto del proyecto). Verificación manual vía Playwright contra el dev server, usando `page.context().setOffline(true)`/`setOffline(false)` para simular pérdida y recuperación de conexión: crear/editar/borrar sets y sesiones offline, verificar que el banner muestra el conteo correcto, reconectar y verificar que la cola se vacía y los datos aparecen en Supabase, y forzar un conflicto (editar la misma fila desde dos contextos de navegador distintos, uno de ellos offline) para verificar que aparece en `/sincronizacion/` con ambas opciones de resolución funcionando.
