# Logueo offline + sincronización Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que crear, editar y borrar entrenamientos/sets/sesiones siga funcionando sin conexión (incluyendo arranque en frío offline), sincronizando solo con Supabase al reconectar, con detección de conflictos y resolución manual cuando el mismo dato cambió en otro dispositivo mientras había un cambio offline pendiente.

**Architecture:** Una cola de escritura + caché de lectura sobre IndexedDB (`src/lib/offlineDb.ts` + `src/lib/offlineQueue.ts`, primitivas puras sin dependencia de Supabase) se intercala dentro de `src/lib/workouts.ts`: cada función pública mantiene su firma actual, intenta la llamada real a Supabase primero, y solo cae a la cola si el intento falla por un error de red (nunca por un error de negocio/validación, que sigue propagándose igual que hoy). `src/lib/workouts.ts` gana funciones internas `*Remote` (la lógica de hoy, sin cambios de comportamiento, solo renombradas) más `flushQueue()`, que reproduce la cola contra esas mismas funciones `*Remote` al reconectar. Cero cambios en las firmas que consumen `WorkoutLogger.tsx`/`WorkoutHistory.tsx`; sí se agrega en esos dos archivos (y en `ProgressList.tsx`) un listener chico de un evento `selfgains:sync-complete` para refrescar la UI después de un sync en segundo plano — la única razón por la que esos archivos se tocan.

**Tech Stack:** IndexedDB vía el paquete `idb` (~3kb, wrapper delgado sobre la API nativa), React (patrón existente), Supabase (`@supabase/supabase-js`, ya en el stack — se usa `isAuthRetryableFetchError`, ya exportado por el paquete, para detectar fallas de red en llamadas de autenticación), Playwright (`page.context().setOffline()`) para la verificación manual final.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-16-logueo-offline-y-sync-design.md`.

**Notas de implementación que no estaban explícitas en el spec, decididas por necesidad técnica al escribir este plan:**

1. **Separación Remote / wrapper / cola dentro de un solo archivo.** El spec describía `offlineQueue.ts` como dueño de "encolar operaciones, flushQueue()". En la práctica, `flushQueue()` necesita llamar a las funciones que hablan con Supabase — si esas viven en `workouts.ts` (que a su vez importa `offlineQueue.ts` para encolar), poner `flushQueue()` en `offlineQueue.ts` crearía un import circular. Se resuelve así: `offlineQueue.ts` queda como primitivas puras de IndexedDB (sin importar Supabase ni `workouts.ts`), y `flushQueue()` vive en `workouts.ts`, que sí puede importar `offlineQueue.ts` (dependencia en un solo sentido).
2. **Detección de error de red verificada contra el código fuente instalado**, no asumida: un fallo de red en una llamada Postgrest (`.insert()`, `.update()`, etc.) devuelve `{ error: { code: '', message: 'TypeError: ...' } }` (confirmado leyendo `node_modules/@supabase/postgrest-js/src/PostgrestBuilder.ts`); un fallo de red en una llamada de auth (`supabase.auth.getUser()`, que sí golpea la red) lanza `AuthRetryableFetchError`, detectable con `isAuthRetryableFetchError` (confirmado en `node_modules/@supabase/auth-js/src/lib/errors.ts`, re-exportado por `@supabase/supabase-js`). `isNetworkError()` en `offlineQueue.ts` chequea ambos casos.
3. **Índice `setId → workoutId` / `sessionId → workoutId`.** `updateSet(setId, ...)`/`deleteSet(setId, ...)` no reciben `workoutId` (la firma no cambia), pero encolar la operación y parchear el caché de lectura sí lo necesita. En vez de cambiar la firma, se mantiene un índice chico en el store `cache` (`setWorkoutIndex`, `sessionWorkoutIndex`) que se llena cada vez que se lee o crea un set/sesión. Si el índice no tiene la entrada (caso raro: editar algo offline sin haberlo visto nunca en este dispositivo), la operación igual se encola y sincroniza bien — solo se salta el parcheo cosmético del caché de esa lista puntual.
4. **`updateSet`/`updateSession` tienen dos variantes remotas:** una sin condición (`updateSetRemote`, usada en el intento online directo — comportamiento idéntico al de hoy) y una condicionada por `updated_at` (`updateSetConditionalRemote`, usada solo al reproducir la cola, que es el único momento donde puede haber pasado tiempo suficiente para un conflicto real). `deleteSet`/`deleteSession`/`deleteWorkout` no necesitan condición — un `DELETE` por id es seguro de reintentar (si ya no existe, 0 filas afectadas es simplemente un no-op, no un conflicto).
5. **Refresco de UI tras un sync en segundo plano.** El spec no cubre explícitamente qué pasa con los componentes ya montados cuando `flushQueue()` sincroniza datos mientras la app está abierta. Se agrega un evento de navegador `selfgains:sync-complete`, disparado por `flushQueue()` cuando procesó al menos un item, y un listener chico en `WorkoutLogger.tsx`/`ProgressList.tsx` que reusa su lógica de carga existente. Es la extensión mínima necesaria para que la UI no se quede mostrando datos temporales después de sincronizar.

---

## File Structure

- **Modify:** `supabase/schema.sql` — agrega `updated_at` + triggers a `workout_sets`/`workout_sessions`.
- **Modify:** `src/types/db.ts` — agrega `updated_at: string` a `WorkoutSet`/`WorkoutSession`.
- **Modify:** `package.json` — agrega dependencia `idb`.
- **Create:** `src/lib/offlineDb.ts` — apertura de la base IndexedDB (`idb`), tipos `QueueItem`/`ConflictItem`.
- **Create:** `src/lib/offlineQueue.ts` — primitivas: caché de lectura, cola, índices, conflictos, detección de error de red. Sin dependencia de Supabase.
- **Modify:** `src/lib/workouts.ts` — reescritura completa: funciones `*Remote` internas (comportamiento de hoy, renombradas), wrappers públicos con la misma firma de hoy, `flushQueue()`.
- **Modify:** `src/lib/routines.ts` — `getActiveRoutine` gana caché de lectura offline.
- **Create:** `src/components/react/SyncBanner/SyncBanner.tsx` — banner global, dispara `flushQueue()` al montar/reconectar.
- **Modify:** `src/layouts/BaseLayout.astro` — monta `<SyncBanner client:load />`.
- **Modify:** `src/components/react/WorkoutLogger/WorkoutLogger.tsx` — listener de `selfgains:sync-complete`.
- **Modify:** `src/components/react/ProgressList/ProgressList.tsx` — listener de `selfgains:sync-complete`.
- **Create:** `src/components/react/SyncBanner/ConflictResolution.tsx` — UI de resolución de conflictos.
- **Create:** `src/pages/sincronizacion.astro` — página que monta `ConflictResolution`.

---

### Task 1: Migración de base de datos + tipos

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/types/db.ts`

- [ ] **Step 1: Agregar la migración al final de `supabase/schema.sql`**

```sql

-- updated_at + trigger para detección de conflictos en la sincronización
-- offline (docs/superpowers/specs/2026-08-16-logueo-offline-y-sync-design.md).
-- workouts no lo necesita: no tiene UPDATE hoy, solo DELETE.
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

- [ ] **Step 2: Aplicar la migración contra el proyecto real**

Escribir el mismo bloque SQL del Step 1 a un archivo temporal y ejecutarlo:

```bash
cat > /tmp/selfgains-offline-migration.sql << 'EOF'
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
EOF
supabase db query --linked --file /tmp/selfgains-offline-migration.sql
rm /tmp/selfgains-offline-migration.sql
```
Expected: sin errores. Si el proyecto no está linkeado en el entorno de ejecución, correr `supabase link` primero (ver `docs/agents/notas-de-entorno-y-lecciones.md` para el patrón ya usado en este repo).

- [ ] **Step 3: Verificar que las columnas existen**

```bash
supabase db query --linked "select table_name, column_name from information_schema.columns where table_name in ('workout_sets', 'workout_sessions') and column_name = 'updated_at';"
```
Expected: dos filas, una por tabla.

- [ ] **Step 4: Agregar `updated_at` a los tipos TypeScript**

En `src/types/db.ts`, reemplazar:

```ts
export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number | null;
  created_at: string;
}
```

por:

```ts
export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number | null;
  created_at: string;
  updated_at: string;
}
```

y reemplazar:

```ts
export interface WorkoutSession {
  id: string;
  workout_id: string;
  activity_id: string;
  duration_min: number;
  distance_km: number | null;
  created_at: string;
}
```

por:

```ts
export interface WorkoutSession {
  id: string;
  workout_id: string;
  activity_id: string;
  duration_min: number;
  distance_km: number | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/types/db.ts
git commit -m "feat: add updated_at to workout_sets/workout_sessions for offline conflict detection"
```

---

### Task 2: Dependencia `idb` + apertura de IndexedDB

**Files:**
- Modify: `package.json`
- Create: `src/lib/offlineDb.ts`

- [ ] **Step 1: Instalar `idb`**

```bash
npm install idb@^8.0.0
```
Expected: `package.json`/`package-lock.json` actualizados, `idb` en `dependencies`.

- [ ] **Step 2: Crear `src/lib/offlineDb.ts`**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type QueueOperationType =
  | 'createWorkout'
  | 'addSet'
  | 'addSession'
  | 'updateSet'
  | 'deleteSet'
  | 'updateSession'
  | 'deleteSession'
  | 'deleteWorkout';

export interface QueueItem {
  id?: number;
  type: QueueOperationType;
  payload: Record<string, unknown>;
  tempId?: string;
  dependsOnTempId?: string;
  snapshotUpdatedAt?: string;
  createdAt: string;
}

export interface ConflictItem {
  id?: number;
  queueItem: QueueItem;
  serverSnapshot: Record<string, unknown> | null;
  detectedAt: string;
}

interface SelfGainsOfflineDB extends DBSchema {
  cache: {
    key: string;
    value: unknown;
  };
  queue: {
    key: number;
    value: QueueItem;
  };
  conflicts: {
    key: number;
    value: ConflictItem;
  };
}

let dbPromise: Promise<IDBPDatabase<SelfGainsOfflineDB>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<SelfGainsOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SelfGainsOfflineDB>('selfgains-offline', 1, {
      upgrade(db) {
        db.createObjectStore('cache');
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('conflicts', { keyPath: 'id', autoIncrement: true });
      },
    });
  }
  return dbPromise;
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (nada importa este archivo todavía, así que solo confirma sintaxis/tipos).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/offlineDb.ts
git commit -m "feat: add idb dependency and IndexedDB schema for offline sync"
```

---

### Task 3: Primitivas de cola y caché (`offlineQueue.ts`)

**Files:**
- Create: `src/lib/offlineQueue.ts`

- [ ] **Step 1: Crear `src/lib/offlineQueue.ts`**

```ts
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { getOfflineDb, type ConflictItem, type QueueItem } from './offlineDb';

// Un fallo de red en una llamada Postgrest vuelve como
// { error: { code: '', message: 'TypeError: ...' } } (confirmado en
// @supabase/postgrest-js/src/PostgrestBuilder.ts). Un fallo de red en una
// llamada de auth (supabase.auth.getUser(), que sí pega a la red) lanza
// AuthRetryableFetchError. Cualquier otro error (validación, permisos,
// fila no encontrada) NO debe tratarse como "estoy offline".
export function isNetworkError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; message?: unknown };
    return e.code === '' && typeof e.message === 'string' && e.message.startsWith('TypeError:');
  }
  return false;
}

export function newTempId(): string {
  return crypto.randomUUID();
}

export async function readCache<T>(key: string): Promise<T | null> {
  const db = await getOfflineDb();
  const value = await db.get('cache', key);
  return (value as T) ?? null;
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  const db = await getOfflineDb();
  await db.put('cache', value, key);
}

export async function patchCacheArray<T>(key: string, updater: (items: T[]) => T[]): Promise<void> {
  const current = (await readCache<T[]>(key)) ?? [];
  await writeCache(key, updater(current));
}

export async function enqueue(item: Omit<QueueItem, 'id' | 'createdAt'>): Promise<QueueItem> {
  const db = await getOfflineDb();
  const full: Omit<QueueItem, 'id'> = { ...item, createdAt: new Date().toISOString() };
  const id = await db.add('queue', full as QueueItem);
  return { ...full, id: id as number };
}

export async function updateQueueItem(id: number, updates: Partial<QueueItem>): Promise<void> {
  const db = await getOfflineDb();
  const existing = await db.get('queue', id);
  if (!existing) return;
  await db.put('queue', { ...existing, ...updates });
}

export async function getQueueItems(): Promise<QueueItem[]> {
  const db = await getOfflineDb();
  return db.getAll('queue');
}

export async function getQueueCount(): Promise<number> {
  const db = await getOfflineDb();
  return db.count('queue');
}

export async function removeQueueItem(id: number): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('queue', id);
}

export async function findQueuedCreateByTempId(tempId: string): Promise<QueueItem | undefined> {
  const items = await getQueueItems();
  return items.find((item) => item.tempId === tempId);
}

export async function indexSetWorkout(setId: string, workoutId: string): Promise<void> {
  const index = (await readCache<Record<string, string>>('setWorkoutIndex')) ?? {};
  index[setId] = workoutId;
  await writeCache('setWorkoutIndex', index);
}

export async function lookupSetWorkout(setId: string): Promise<string | undefined> {
  const index = await readCache<Record<string, string>>('setWorkoutIndex');
  return index?.[setId];
}

export async function indexSessionWorkout(sessionId: string, workoutId: string): Promise<void> {
  const index = (await readCache<Record<string, string>>('sessionWorkoutIndex')) ?? {};
  index[sessionId] = workoutId;
  await writeCache('sessionWorkoutIndex', index);
}

export async function lookupSessionWorkout(sessionId: string): Promise<string | undefined> {
  const index = await readCache<Record<string, string>>('sessionWorkoutIndex');
  return index?.[sessionId];
}

export async function addConflict(
  queueItem: QueueItem,
  serverSnapshot: Record<string, unknown> | null
): Promise<void> {
  const db = await getOfflineDb();
  const conflict: Omit<ConflictItem, 'id'> = {
    queueItem,
    serverSnapshot,
    detectedAt: new Date().toISOString(),
  };
  await db.add('conflicts', conflict as ConflictItem);
}

export async function getConflicts(): Promise<ConflictItem[]> {
  const db = await getOfflineDb();
  return db.getAll('conflicts');
}

export async function getConflictCount(): Promise<number> {
  const db = await getOfflineDb();
  return db.count('conflicts');
}

export async function removeConflict(id: number): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('conflicts', id);
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios.

- [ ] **Step 3: Commit**

```bash
git add src/lib/offlineQueue.ts
git commit -m "feat: add offline queue and cache primitives over IndexedDB"
```

---

### Task 4: Reescribir `src/lib/workouts.ts` con soporte offline

Este archivo se reescribe completo: agrega las funciones `*Remote` (comportamiento de hoy, renombradas), los wrappers públicos (misma firma que hoy) y `flushQueue()`. Se presenta como un solo paso porque todo el archivo es interdependiente — dividirlo en pasos parciales dejaría estados intermedios con funciones a medio definir.

**Files:**
- Modify: `src/lib/workouts.ts` (reemplazo completo)

- [ ] **Step 1: Reemplazar todo el contenido de `src/lib/workouts.ts`**

```ts
import { supabase } from './supabase';
import type { Workout, WorkoutSet, WorkoutSession } from '../types/db';
import {
  addConflict,
  enqueue,
  findQueuedCreateByTempId,
  getQueueItems,
  indexSessionWorkout,
  indexSetWorkout,
  isNetworkError,
  lookupSessionWorkout,
  lookupSetWorkout,
  newTempId,
  patchCacheArray,
  readCache,
  removeQueueItem,
  updateQueueItem,
} from './offlineQueue';
import type { QueueItem } from './offlineDb';

async function getCurrentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

// ---------------------------------------------------------------------
// Remote (red) — misma lógica de siempre, solo renombrada. Se usan tanto
// para el primer intento online como para reproducir la cola al reconectar.
// ---------------------------------------------------------------------

async function createWorkoutRemote(date: string, notes?: string, planId?: string): Promise<Workout> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: user.id, date, notes: notes ?? null, plan_id: planId ?? null })
    .select()
    .single();

  if (error) throw error;
  return data as Workout;
}

async function addSetRemote(
  workoutId: string,
  exerciseId: string,
  setNumber: number,
  reps: number,
  weight: number,
  rpe?: number
): Promise<WorkoutSet> {
  const { data, error } = await supabase
    .from('workout_sets')
    .insert({
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_number: setNumber,
      reps,
      weight,
      rpe: rpe ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkoutSet;
}

async function addSessionRemote(
  workoutId: string,
  activityId: string,
  durationMin: number,
  distanceKm?: number
): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      workout_id: workoutId,
      activity_id: activityId,
      duration_min: durationMin,
      distance_km: distanceKm ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkoutSession;
}

async function getWorkoutsRemote(): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .order('date', { ascending: false });

  if (error) throw error;
  return data as Workout[];
}

async function getSetsRemote(workoutId: string): Promise<WorkoutSet[]> {
  const { data, error } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('workout_id', workoutId)
    .order('exercise_id', { ascending: true })
    .order('set_number', { ascending: true });

  if (error) throw error;
  return data as WorkoutSet[];
}

async function getSessionsRemote(workoutId: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as WorkoutSession[];
}

// Sin condición de updated_at — mismo comportamiento que el updateSet de
// siempre. Se usa en el intento online directo y también desde la UI de
// resolución de conflictos ("Mantener el mío"), por eso está exportada.
export async function updateSetRemote(
  setId: string,
  reps: number,
  weight: number,
  rpe?: number
): Promise<WorkoutSet> {
  const { data, error } = await supabase
    .from('workout_sets')
    .update({ reps, weight, rpe: rpe ?? null })
    .eq('id', setId)
    .select()
    .single();

  if (error) throw error;
  return data as WorkoutSet;
}

// Condicionada por updated_at — se usa solo al reproducir la cola, que es
// el único momento donde puede haber pasado tiempo suficiente para un
// conflicto real con otro dispositivo.
async function updateSetConditionalRemote(
  setId: string,
  reps: number,
  weight: number,
  rpe: number | undefined,
  snapshotUpdatedAt: string | undefined
): Promise<{ result: WorkoutSet } | { conflict: WorkoutSet | null }> {
  let query = supabase.from('workout_sets').update({ reps, weight, rpe: rpe ?? null }).eq('id', setId);
  if (snapshotUpdatedAt) query = query.eq('updated_at', snapshotUpdatedAt);
  const { data, error } = await query.select();

  if (error) throw error;
  if (data.length === 0) {
    const current = await supabase.from('workout_sets').select('*').eq('id', setId).maybeSingle();
    if (current.error) throw current.error;
    return { conflict: current.data as WorkoutSet | null };
  }
  return { result: data[0] as WorkoutSet };
}

async function deleteSetRemote(setId: string): Promise<void> {
  const { error } = await supabase.from('workout_sets').delete().eq('id', setId);
  if (error) throw error;
}

export async function updateSessionRemote(
  sessionId: string,
  durationMin: number,
  distanceKm?: number
): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .update({ duration_min: durationMin, distance_km: distanceKm ?? null })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data as WorkoutSession;
}

async function updateSessionConditionalRemote(
  sessionId: string,
  durationMin: number,
  distanceKm: number | undefined,
  snapshotUpdatedAt: string | undefined
): Promise<{ result: WorkoutSession } | { conflict: WorkoutSession | null }> {
  let query = supabase
    .from('workout_sessions')
    .update({ duration_min: durationMin, distance_km: distanceKm ?? null })
    .eq('id', sessionId);
  if (snapshotUpdatedAt) query = query.eq('updated_at', snapshotUpdatedAt);
  const { data, error } = await query.select();

  if (error) throw error;
  if (data.length === 0) {
    const current = await supabase.from('workout_sessions').select('*').eq('id', sessionId).maybeSingle();
    if (current.error) throw current.error;
    return { conflict: current.data as WorkoutSession | null };
  }
  return { result: data[0] as WorkoutSession };
}

async function deleteSessionRemote(sessionId: string): Promise<void> {
  const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

async function deleteWorkoutRemote(workoutId: string): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// API pública — misma firma que antes de este cambio. Intenta la red
// primero; si falla por red, encola. Si el objetivo ya es un id temporal
// sin sincronizar, la operación se aplica directo sobre lo encolado.
// ---------------------------------------------------------------------

export async function createWorkout(date: string, notes?: string, planId?: string): Promise<Workout> {
  try {
    const workout = await createWorkoutRemote(date, notes, planId);
    await patchCacheArray<Workout>(`workouts:${workout.user_id}`, (items) => [workout, ...items]);
    return workout;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return await queueCreateWorkout(date, notes, planId);
  }
}

async function queueCreateWorkout(date: string, notes?: string, planId?: string): Promise<Workout> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No hay sesión activa');
  const tempId = newTempId();
  const optimistic: Workout = {
    id: tempId,
    user_id: userId,
    date,
    notes: notes ?? null,
    plan_id: planId ?? null,
    created_at: new Date().toISOString(),
  };
  await enqueue({
    type: 'createWorkout',
    payload: { date, notes: notes ?? null, planId: planId ?? null, userId },
    tempId,
  });
  await patchCacheArray<Workout>(`workouts:${userId}`, (items) => [optimistic, ...items]);
  return optimistic;
}

export async function addSet(
  workoutId: string,
  exerciseId: string,
  setNumber: number,
  reps: number,
  weight: number,
  rpe?: number
): Promise<WorkoutSet> {
  const pendingWorkout = await findQueuedCreateByTempId(workoutId);
  if (pendingWorkout) {
    return await queueAddSet(workoutId, exerciseId, setNumber, reps, weight, rpe, true);
  }
  try {
    const set = await addSetRemote(workoutId, exerciseId, setNumber, reps, weight, rpe);
    await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, (items) => [...items, set]);
    await indexSetWorkout(set.id, workoutId);
    return set;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return await queueAddSet(workoutId, exerciseId, setNumber, reps, weight, rpe, false);
  }
}

async function queueAddSet(
  workoutId: string,
  exerciseId: string,
  setNumber: number,
  reps: number,
  weight: number,
  rpe: number | undefined,
  parentIsTemp: boolean
): Promise<WorkoutSet> {
  const tempId = newTempId();
  const now = new Date().toISOString();
  const optimistic: WorkoutSet = {
    id: tempId,
    workout_id: workoutId,
    exercise_id: exerciseId,
    set_number: setNumber,
    reps,
    weight,
    rpe: rpe ?? null,
    created_at: now,
    updated_at: now,
  };
  await enqueue({
    type: 'addSet',
    payload: { workoutId, exerciseId, setNumber, reps, weight, rpe: rpe ?? null },
    tempId,
    dependsOnTempId: parentIsTemp ? workoutId : undefined,
  });
  await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, (items) => [...items, optimistic]);
  await indexSetWorkout(tempId, workoutId);
  return optimistic;
}

export async function addSession(
  workoutId: string,
  activityId: string,
  durationMin: number,
  distanceKm?: number
): Promise<WorkoutSession> {
  const pendingWorkout = await findQueuedCreateByTempId(workoutId);
  if (pendingWorkout) {
    return await queueAddSession(workoutId, activityId, durationMin, distanceKm, true);
  }
  try {
    const session = await addSessionRemote(workoutId, activityId, durationMin, distanceKm);
    await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, (items) => [...items, session]);
    await indexSessionWorkout(session.id, workoutId);
    return session;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return await queueAddSession(workoutId, activityId, durationMin, distanceKm, false);
  }
}

async function queueAddSession(
  workoutId: string,
  activityId: string,
  durationMin: number,
  distanceKm: number | undefined,
  parentIsTemp: boolean
): Promise<WorkoutSession> {
  const tempId = newTempId();
  const now = new Date().toISOString();
  const optimistic: WorkoutSession = {
    id: tempId,
    workout_id: workoutId,
    activity_id: activityId,
    duration_min: durationMin,
    distance_km: distanceKm ?? null,
    created_at: now,
    updated_at: now,
  };
  await enqueue({
    type: 'addSession',
    payload: { workoutId, activityId, durationMin, distanceKm: distanceKm ?? null },
    tempId,
    dependsOnTempId: parentIsTemp ? workoutId : undefined,
  });
  await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, (items) => [...items, optimistic]);
  await indexSessionWorkout(tempId, workoutId);
  return optimistic;
}

export async function getWorkoutsForCurrentUser(): Promise<Workout[]> {
  const userId = await getCurrentUserId();
  try {
    const data = await getWorkoutsRemote();
    if (userId) await patchCacheArray<Workout>(`workouts:${userId}`, () => data);
    return data;
  } catch (err) {
    if (!isNetworkError(err) || !userId) throw err;
    return (await readCache<Workout[]>(`workouts:${userId}`)) ?? [];
  }
}

export async function getSetsForWorkout(workoutId: string): Promise<WorkoutSet[]> {
  try {
    const data = await getSetsRemote(workoutId);
    await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, () => data);
    for (const s of data) await indexSetWorkout(s.id, workoutId);
    return data;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return (await readCache<WorkoutSet[]>(`sets:${workoutId}`)) ?? [];
  }
}

export async function getSessionsForWorkout(workoutId: string): Promise<WorkoutSession[]> {
  try {
    const data = await getSessionsRemote(workoutId);
    await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, () => data);
    for (const s of data) await indexSessionWorkout(s.id, workoutId);
    return data;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return (await readCache<WorkoutSession[]>(`sessions:${workoutId}`)) ?? [];
  }
}

export async function updateSet(setId: string, reps: number, weight: number, rpe?: number): Promise<WorkoutSet> {
  const pending = await findQueuedCreateByTempId(setId);
  if (pending) {
    const patchedPayload = { ...pending.payload, reps, weight, rpe: rpe ?? null };
    await updateQueueItem(pending.id!, { payload: patchedPayload });
    const workoutId = patchedPayload.workoutId as string;
    const now = new Date().toISOString();
    const optimistic: WorkoutSet = {
      id: setId,
      workout_id: workoutId,
      exercise_id: patchedPayload.exerciseId as string,
      set_number: patchedPayload.setNumber as number,
      reps,
      weight,
      rpe: rpe ?? null,
      created_at: now,
      updated_at: now,
    };
    await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, (items) =>
      items.map((s) => (s.id === setId ? optimistic : s))
    );
    return optimistic;
  }

  try {
    return await updateSetRemote(setId, reps, weight, rpe);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return await queueUpdateSet(setId, reps, weight, rpe);
  }
}

async function queueUpdateSet(setId: string, reps: number, weight: number, rpe?: number): Promise<WorkoutSet> {
  const workoutId = await lookupSetWorkout(setId);
  const cached = workoutId ? ((await readCache<WorkoutSet[]>(`sets:${workoutId}`)) ?? []) : [];
  const existing = cached.find((s) => s.id === setId);
  await enqueue({
    type: 'updateSet',
    payload: { setId, workoutId, reps, weight, rpe: rpe ?? null },
    snapshotUpdatedAt: existing?.updated_at,
  });
  const optimistic: WorkoutSet = {
    id: setId,
    workout_id: workoutId ?? existing?.workout_id ?? '',
    exercise_id: existing?.exercise_id ?? '',
    set_number: existing?.set_number ?? 0,
    reps,
    weight,
    rpe: rpe ?? null,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (workoutId) {
    await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, (items) =>
      items.map((s) => (s.id === setId ? optimistic : s))
    );
  }
  return optimistic;
}

export async function deleteSet(setId: string): Promise<void> {
  const pending = await findQueuedCreateByTempId(setId);
  if (pending) {
    await removeQueueItem(pending.id!);
    const workoutId = pending.payload.workoutId as string | undefined;
    if (workoutId) {
      await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, (items) => items.filter((s) => s.id !== setId));
    }
    return;
  }
  try {
    await deleteSetRemote(setId);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const workoutId = await lookupSetWorkout(setId);
    await enqueue({ type: 'deleteSet', payload: { setId, workoutId } });
    if (workoutId) {
      await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, (items) => items.filter((s) => s.id !== setId));
    }
  }
}

export async function updateSession(
  sessionId: string,
  durationMin: number,
  distanceKm?: number
): Promise<WorkoutSession> {
  const pending = await findQueuedCreateByTempId(sessionId);
  if (pending) {
    const patchedPayload = { ...pending.payload, durationMin, distanceKm: distanceKm ?? null };
    await updateQueueItem(pending.id!, { payload: patchedPayload });
    const workoutId = patchedPayload.workoutId as string;
    const now = new Date().toISOString();
    const optimistic: WorkoutSession = {
      id: sessionId,
      workout_id: workoutId,
      activity_id: patchedPayload.activityId as string,
      duration_min: durationMin,
      distance_km: distanceKm ?? null,
      created_at: now,
      updated_at: now,
    };
    await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, (items) =>
      items.map((s) => (s.id === sessionId ? optimistic : s))
    );
    return optimistic;
  }

  try {
    return await updateSessionRemote(sessionId, durationMin, distanceKm);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return await queueUpdateSession(sessionId, durationMin, distanceKm);
  }
}

async function queueUpdateSession(
  sessionId: string,
  durationMin: number,
  distanceKm: number | undefined
): Promise<WorkoutSession> {
  const workoutId = await lookupSessionWorkout(sessionId);
  const cached = workoutId ? ((await readCache<WorkoutSession[]>(`sessions:${workoutId}`)) ?? []) : [];
  const existing = cached.find((s) => s.id === sessionId);
  await enqueue({
    type: 'updateSession',
    payload: { sessionId, workoutId, durationMin, distanceKm: distanceKm ?? null },
    snapshotUpdatedAt: existing?.updated_at,
  });
  const optimistic: WorkoutSession = {
    id: sessionId,
    workout_id: workoutId ?? existing?.workout_id ?? '',
    activity_id: existing?.activity_id ?? '',
    duration_min: durationMin,
    distance_km: distanceKm ?? null,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (workoutId) {
    await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, (items) =>
      items.map((s) => (s.id === sessionId ? optimistic : s))
    );
  }
  return optimistic;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const pending = await findQueuedCreateByTempId(sessionId);
  if (pending) {
    await removeQueueItem(pending.id!);
    const workoutId = pending.payload.workoutId as string | undefined;
    if (workoutId) {
      await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, (items) =>
        items.filter((s) => s.id !== sessionId)
      );
    }
    return;
  }
  try {
    await deleteSessionRemote(sessionId);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const workoutId = await lookupSessionWorkout(sessionId);
    await enqueue({ type: 'deleteSession', payload: { sessionId, workoutId } });
    if (workoutId) {
      await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, (items) =>
        items.filter((s) => s.id !== sessionId)
      );
    }
  }
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  const pending = await findQueuedCreateByTempId(workoutId);
  if (pending) {
    await removeQueueItem(pending.id!);
    const userId = pending.payload.userId as string | undefined;
    if (userId) {
      await patchCacheArray<Workout>(`workouts:${userId}`, (items) => items.filter((w) => w.id !== workoutId));
    }
    return;
  }
  try {
    await deleteWorkoutRemote(workoutId);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const userId = await getCurrentUserId();
    await enqueue({ type: 'deleteWorkout', payload: { workoutId, userId } });
    if (userId) {
      await patchCacheArray<Workout>(`workouts:${userId}`, (items) => items.filter((w) => w.id !== workoutId));
    }
  }
}

// ---------------------------------------------------------------------
// Reproducción de la cola al reconectar.
// ---------------------------------------------------------------------

export async function flushQueue(): Promise<void> {
  if (!navigator.onLine) return;
  const tempIdMap = new Map<string, string>();
  let processedAny = false;

  for (;;) {
    const items = await getQueueItems();
    const item = items.find((i) => !i.dependsOnTempId || tempIdMap.has(i.dependsOnTempId));
    if (!item) break;

    const outcome = await applyQueueItem(item, tempIdMap);
    if (outcome === 'network-error') break;
    await removeQueueItem(item.id!);
    processedAny = true;
  }

  if (processedAny) {
    window.dispatchEvent(new CustomEvent('selfgains:sync-complete'));
  }
}

async function applyQueueItem(item: QueueItem, tempIdMap: Map<string, string>): Promise<'ok' | 'network-error'> {
  try {
    switch (item.type) {
      case 'createWorkout': {
        const p = item.payload as { date: string; notes: string | null; planId: string | null };
        const workout = await createWorkoutRemote(p.date, p.notes ?? undefined, p.planId ?? undefined);
        if (item.tempId) tempIdMap.set(item.tempId, workout.id);
        await patchCacheArray<Workout>(`workouts:${workout.user_id}`, (items) =>
          items.map((w) => (w.id === item.tempId ? workout : w))
        );
        return 'ok';
      }
      case 'addSet': {
        const p = item.payload as {
          workoutId: string;
          exerciseId: string;
          setNumber: number;
          reps: number;
          weight: number;
          rpe: number | null;
        };
        const realWorkoutId = item.dependsOnTempId ? tempIdMap.get(item.dependsOnTempId)! : p.workoutId;
        const set = await addSetRemote(realWorkoutId, p.exerciseId, p.setNumber, p.reps, p.weight, p.rpe ?? undefined);
        if (item.tempId) tempIdMap.set(item.tempId, set.id);
        await patchCacheArray<WorkoutSet>(`sets:${realWorkoutId}`, (items) =>
          items.map((s) => (s.id === item.tempId ? set : s))
        );
        await indexSetWorkout(set.id, realWorkoutId);
        return 'ok';
      }
      case 'addSession': {
        const p = item.payload as {
          workoutId: string;
          activityId: string;
          durationMin: number;
          distanceKm: number | null;
        };
        const realWorkoutId = item.dependsOnTempId ? tempIdMap.get(item.dependsOnTempId)! : p.workoutId;
        const session = await addSessionRemote(
          realWorkoutId,
          p.activityId,
          p.durationMin,
          p.distanceKm ?? undefined
        );
        if (item.tempId) tempIdMap.set(item.tempId, session.id);
        await patchCacheArray<WorkoutSession>(`sessions:${realWorkoutId}`, (items) =>
          items.map((s) => (s.id === item.tempId ? session : s))
        );
        await indexSessionWorkout(session.id, realWorkoutId);
        return 'ok';
      }
      case 'updateSet': {
        const p = item.payload as { setId: string; workoutId?: string; reps: number; weight: number; rpe: number | null };
        const outcome = await updateSetConditionalRemote(p.setId, p.reps, p.weight, p.rpe ?? undefined, item.snapshotUpdatedAt);
        if ('conflict' in outcome) {
          await addConflict(item, outcome.conflict as unknown as Record<string, unknown> | null);
          return 'ok';
        }
        if (p.workoutId) {
          await patchCacheArray<WorkoutSet>(`sets:${p.workoutId}`, (items) =>
            items.map((s) => (s.id === p.setId ? outcome.result : s))
          );
        }
        return 'ok';
      }
      case 'deleteSet': {
        const p = item.payload as { setId: string; workoutId?: string };
        await deleteSetRemote(p.setId);
        if (p.workoutId) {
          await patchCacheArray<WorkoutSet>(`sets:${p.workoutId}`, (items) => items.filter((s) => s.id !== p.setId));
        }
        return 'ok';
      }
      case 'updateSession': {
        const p = item.payload as {
          sessionId: string;
          workoutId?: string;
          durationMin: number;
          distanceKm: number | null;
        };
        const outcome = await updateSessionConditionalRemote(
          p.sessionId,
          p.durationMin,
          p.distanceKm ?? undefined,
          item.snapshotUpdatedAt
        );
        if ('conflict' in outcome) {
          await addConflict(item, outcome.conflict as unknown as Record<string, unknown> | null);
          return 'ok';
        }
        if (p.workoutId) {
          await patchCacheArray<WorkoutSession>(`sessions:${p.workoutId}`, (items) =>
            items.map((s) => (s.id === p.sessionId ? outcome.result : s))
          );
        }
        return 'ok';
      }
      case 'deleteSession': {
        const p = item.payload as { sessionId: string; workoutId?: string };
        await deleteSessionRemote(p.sessionId);
        if (p.workoutId) {
          await patchCacheArray<WorkoutSession>(`sessions:${p.workoutId}`, (items) =>
            items.filter((s) => s.id !== p.sessionId)
          );
        }
        return 'ok';
      }
      case 'deleteWorkout': {
        const p = item.payload as { workoutId: string; userId?: string };
        await deleteWorkoutRemote(p.workoutId);
        if (p.userId) {
          await patchCacheArray<Workout>(`workouts:${p.userId}`, (items) => items.filter((w) => w.id !== p.workoutId));
        }
        return 'ok';
      }
    }
  } catch (err) {
    if (isNetworkError(err)) return 'network-error';
    // Cualquier otro error (violación de FK porque el workout padre ya no
    // existe, o cualquier fallo inesperado) se muestra como conflicto en
    // vez de trabar el resto de la cola — ver sección 3.7 y 4 del spec.
    await addConflict(item, null);
    return 'ok';
  }
  return 'ok';
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx:162` (confirmado con `git stash` en `docs/agents/notas-de-entorno-y-lecciones.md` — ya estaba antes de este trabajo).

- [ ] **Step 3: Commit**

```bash
git add src/lib/workouts.ts
git commit -m "feat: make workouts.ts offline-aware with a write queue and conflict detection"
```

---

### Task 5: Caché de lectura offline para `getActiveRoutine`

**Files:**
- Modify: `src/lib/routines.ts`

- [ ] **Step 1: Agregar el import y envolver `getActiveRoutine`**

Reemplazar:

```ts
import { supabase } from './supabase';
import type { ActiveRoutine, Routine } from '../types/db';
import type { RoutineDays } from './weekdays';
```

por:

```ts
import { supabase } from './supabase';
import type { ActiveRoutine, Routine } from '../types/db';
import type { RoutineDays } from './weekdays';
import { isNetworkError, readCache, writeCache } from './offlineQueue';
```

Reemplazar:

```ts
export async function getActiveRoutine(): Promise<ActiveRoutine | null> {
  const { data, error } = await supabase.from('active_routines').select('*').maybeSingle();

  if (error) throw error;
  return data as ActiveRoutine | null;
}
```

por:

```ts
export async function getActiveRoutine(): Promise<ActiveRoutine | null> {
  try {
    const { data, error } = await supabase.from('active_routines').select('*').maybeSingle();
    if (error) throw error;
    const result = data as ActiveRoutine | null;
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (userId) await writeCache(`activeRoutine:${userId}`, result);
    return result;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) throw err;
    return await readCache<ActiveRoutine | null>(`activeRoutine:${userId}`);
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (mismo error preexistente de siempre en `ProgressList.tsx:162`, nada más).

- [ ] **Step 3: Commit**

```bash
git add src/lib/routines.ts
git commit -m "feat: cache the active routine for offline cold starts"
```

---

### Task 6: Banner global de sincronización + wiring de `flushQueue`

**Files:**
- Create: `src/components/react/SyncBanner/SyncBanner.tsx`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/react/WorkoutLogger/WorkoutLogger.tsx`
- Modify: `src/components/react/ProgressList/ProgressList.tsx`

- [ ] **Step 1: Crear `SyncBanner.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { flushQueue } from '../../../lib/workouts';
import { getConflictCount, getQueueCount } from '../../../lib/offlineQueue';

export default function SyncBanner() {
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);

  async function refresh() {
    setPending(await getQueueCount());
    setConflicts(await getConflictCount());
  }

  useEffect(() => {
    refresh();

    async function trySync() {
      if (navigator.onLine) {
        await flushQueue();
        await refresh();
      }
    }
    trySync();

    window.addEventListener('online', trySync);
    window.addEventListener('selfgains:sync-complete', refresh);
    return () => {
      window.removeEventListener('online', trySync);
      window.removeEventListener('selfgains:sync-complete', refresh);
    };
  }, []);

  if (conflicts === 0 && pending === 0) return null;

  const base = import.meta.env.BASE_URL;

  if (conflicts > 0) {
    return (
      <a
        href={`${base}sincronizacion/`}
        className="reveal block border-b-2 border-blood bg-surface px-4 py-2 text-center font-mono text-sm text-blood hover:text-paper"
      >
        {conflicts} {conflicts === 1 ? 'conflicto' : 'conflictos'} — revisar
      </a>
    );
  }

  return (
    <p className="reveal border-b-2 border-acid bg-surface px-4 py-2 text-center font-mono text-sm text-paper-dim">
      {pending} {pending === 1 ? 'cambio pendiente' : 'cambios pendientes'} de sincronizar
    </p>
  );
}
```

- [ ] **Step 2: Montar el banner en `BaseLayout.astro`**

Reemplazar:

```astro
import '../styles/global.css';
import Nav from '../components/astro/Nav.astro';
import { ClientRouter, fade } from 'astro:transitions';
```

por:

```astro
import '../styles/global.css';
import Nav from '../components/astro/Nav.astro';
import SyncBanner from '../components/react/SyncBanner/SyncBanner';
import { ClientRouter, fade } from 'astro:transitions';
```

Reemplazar:

```astro
    <Nav />
    <main transition:animate={fade({ duration: '0.2s' })} class="mx-auto max-w-5xl px-4 py-10 pb-24 sm:px-6 sm:py-14">
      <slot />
    </main>
```

por:

```astro
    <Nav />
    <SyncBanner client:load />
    <main transition:animate={fade({ duration: '0.2s' })} class="mx-auto max-w-5xl px-4 py-10 pb-24 sm:px-6 sm:py-14">
      <slot />
    </main>
```

- [ ] **Step 3: Refrescar `WorkoutLogger.tsx` tras un sync en segundo plano**

Reemplazar:

```tsx
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) return;

      const list = await getWorkoutsForCurrentUser();
      const withLogs = await Promise.all(
        list.map(async (w) => ({
          ...w,
          sets: await getSetsForWorkout(w.id),
          sessions: await getSessionsForWorkout(w.id),
        }))
      );
      setPastWorkouts(withLogs);

      const active = await getActiveRoutine();
      if (!active) return;
      setPlanId(active.routine_ref);

      if (active.source === 'predefined') {
        const plan = plans.find((p) => p.id === active.routine_ref);
        setRoutineDaysMap(plan?.days ?? null);
      } else {
        const routine = await getRoutineById(active.routine_ref);
        setRoutineDaysMap(routine?.days ?? null);
      }
    });
  }, [plans]);
```

por:

```tsx
  useEffect(() => {
    async function loadFromServer() {
      const { data } = await supabase.auth.getSession();
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) return;

      const list = await getWorkoutsForCurrentUser();
      const withLogs = await Promise.all(
        list.map(async (w) => ({
          ...w,
          sets: await getSetsForWorkout(w.id),
          sessions: await getSessionsForWorkout(w.id),
        }))
      );
      setPastWorkouts(withLogs);

      const active = await getActiveRoutine();
      if (!active) return;
      setPlanId(active.routine_ref);

      if (active.source === 'predefined') {
        const plan = plans.find((p) => p.id === active.routine_ref);
        setRoutineDaysMap(plan?.days ?? null);
      } else {
        const routine = await getRoutineById(active.routine_ref);
        setRoutineDaysMap(routine?.days ?? null);
      }
    }
    loadFromServer();
    window.addEventListener('selfgains:sync-complete', loadFromServer);
    return () => window.removeEventListener('selfgains:sync-complete', loadFromServer);
  }, [plans]);
```

- [ ] **Step 4: Refrescar `ProgressList.tsx` tras un sync en segundo plano**

Reemplazar:

```tsx
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) {
        setLoading(false);
        return;
      }
      await Promise.all([loadWorkouts(), getMyMeasurements().then(setMeasurements)]);
    });
  }, []);
```

por:

```tsx
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) {
        setLoading(false);
        return;
      }
      await Promise.all([loadWorkouts(), getMyMeasurements().then(setMeasurements)]);
    });
  }, []);

  useEffect(() => {
    function onSyncComplete() {
      loadWorkouts();
    }
    window.addEventListener('selfgains:sync-complete', onSyncComplete);
    return () => window.removeEventListener('selfgains:sync-complete', onSyncComplete);
  }, []);
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, 11 páginas generadas (una más que las 10 de antes de este spec — falta la de conflictos, Task 7). `tsc` limpio salvo el error preexistente de `ProgressList.tsx:162`.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/SyncBanner/SyncBanner.tsx src/layouts/BaseLayout.astro src/components/react/WorkoutLogger/WorkoutLogger.tsx src/components/react/ProgressList/ProgressList.tsx
git commit -m "feat: add global sync banner and refresh UI after background sync"
```

---

### Task 7: Pantalla de resolución de conflictos

**Files:**
- Create: `src/components/react/SyncBanner/ConflictResolution.tsx`
- Create: `src/pages/sincronizacion.astro`

- [ ] **Step 1: Crear `ConflictResolution.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { ConflictItem } from '../../../lib/offlineDb';
import { getConflicts, patchCacheArray, removeConflict } from '../../../lib/offlineQueue';
import { updateSessionRemote, updateSetRemote } from '../../../lib/workouts';
import type { WorkoutSession, WorkoutSet } from '../../../types/db';

const TYPE_LABEL: Record<string, string> = {
  createWorkout: 'Entrenamiento nuevo',
  addSet: 'Serie nueva',
  addSession: 'Sesión nueva',
  updateSet: 'Edición de una serie',
  deleteSet: 'Borrado de una serie',
  updateSession: 'Edición de una sesión',
  deleteSession: 'Borrado de una sesión',
  deleteWorkout: 'Borrado de un entrenamiento',
}

function describeSetPayload(payload: Record<string, unknown>): string {
  return `${payload.reps} reps × ${payload.weight}kg${payload.rpe ? ` (RPE ${payload.rpe})` : ''}`;
}

function describeSessionPayload(payload: Record<string, unknown>): string {
  const duration = `${payload.durationMin} min`;
  return payload.distanceKm ? `${payload.distanceKm} km en ${duration}` : duration;
}

function describeMine(conflict: ConflictItem): string {
  const { type, payload } = conflict.queueItem;
  if (type === 'updateSet') return describeSetPayload(payload);
  if (type === 'updateSession') return describeSessionPayload(payload);
  return 'este entrenamiento ya no existe en el servidor';
}

function describeTheirs(conflict: ConflictItem): string {
  if (!conflict.serverSnapshot) return 'Ya no existe en el servidor.';
  const { type } = conflict.queueItem;
  if (type === 'updateSet') return describeSetPayload(conflict.serverSnapshot);
  if (type === 'updateSession') return describeSessionPayload(conflict.serverSnapshot);
  return JSON.stringify(conflict.serverSnapshot);
}

export default function ConflictResolution() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConflicts()
      .then(setConflicts)
      .finally(() => setLoading(false));
  }, []);

  async function discard(conflict: ConflictItem) {
    const { queueItem } = conflict;
    const workoutId = (queueItem.payload as { workoutId?: string }).workoutId;
    try {
      if (queueItem.type === 'addSet' && queueItem.tempId && workoutId) {
        await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, (items) =>
          items.filter((s) => s.id !== queueItem.tempId)
        );
      } else if (queueItem.type === 'addSession' && queueItem.tempId && workoutId) {
        await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, (items) =>
          items.filter((s) => s.id !== queueItem.tempId)
        );
      } else if (queueItem.type === 'updateSet' && workoutId) {
        const p = queueItem.payload as { setId: string };
        await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, (items) =>
          conflict.serverSnapshot
            ? items.map((s) => (s.id === p.setId ? (conflict.serverSnapshot as unknown as WorkoutSet) : s))
            : items.filter((s) => s.id !== p.setId)
        );
      } else if (queueItem.type === 'updateSession' && workoutId) {
        const p = queueItem.payload as { sessionId: string };
        await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, (items) =>
          conflict.serverSnapshot
            ? items.map((s) => (s.id === p.sessionId ? (conflict.serverSnapshot as unknown as WorkoutSession) : s))
            : items.filter((s) => s.id !== p.sessionId)
        );
      }
      await removeConflict(conflict.id!);
      setConflicts((prev) => prev.filter((c) => c.id !== conflict.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descartar el cambio.');
    }
  }

  async function keepMine(conflict: ConflictItem) {
    const { queueItem } = conflict;
    try {
      if (queueItem.type === 'updateSet') {
        const p = queueItem.payload as { setId: string; reps: number; weight: number; rpe: number | null };
        await updateSetRemote(p.setId, p.reps, p.weight, p.rpe ?? undefined);
      } else if (queueItem.type === 'updateSession') {
        const p = queueItem.payload as { sessionId: string; durationMin: number; distanceKm: number | null };
        await updateSessionRemote(p.sessionId, p.durationMin, p.distanceKm ?? undefined);
      }
      await removeConflict(conflict.id!);
      setConflicts((prev) => prev.filter((c) => c.id !== conflict.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar el cambio.');
    }
  }

  if (loading) return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;

  if (conflicts.length === 0) {
    return <p className="font-mono text-sm text-paper-dim">No hay conflictos pendientes.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="card-brutal flex flex-col gap-3">
          <p className="label-brutal text-acid">{TYPE_LABEL[conflict.queueItem.type] ?? conflict.queueItem.type}</p>
          <p className="font-mono text-sm text-paper">
            Vos: <span className="text-paper-dim">{describeMine(conflict)}</span>
          </p>
          <p className="font-mono text-sm text-paper">
            Servidor: <span className="text-paper-dim">{describeTheirs(conflict)}</span>
          </p>
          <div className="flex gap-2">
            {conflict.serverSnapshot && (
              <button type="button" onClick={() => keepMine(conflict)} className="btn-brutal-sm">
                Mantener el mío
              </button>
            )}
            <button type="button" onClick={() => discard(conflict)} className="btn-brutal-sm opacity-60">
              {conflict.serverSnapshot ? 'Descartar y usar el del servidor' : 'Descartar mi cambio'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Crear `src/pages/sincronizacion.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ConflictResolution from '../components/react/SyncBanner/ConflictResolution';
---
<BaseLayout title="Sincronización">
  <p class="label-brutal mb-3 text-acid">Cambios sin sincronizar</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">CONFLICTOS</h1>
  <ConflictResolution client:load />
</BaseLayout>
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, 11 páginas generadas (`dist/sincronizacion/index.html` incluida). `tsc` limpio salvo el error preexistente de `ProgressList.tsx:162`.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/SyncBanner/ConflictResolution.tsx src/pages/sincronizacion.astro
git commit -m "feat: add conflict resolution screen for offline sync"
```

---

### Task 8: Verificación manual end-to-end

Sin suite de tests automatizada (consistente con el resto del proyecto). Usa una cuenta de prueba ya confirmada de una sesión anterior (`docs/agents/notas-de-entorno-y-lecciones.md` documenta el patrón — reusar en vez de firmar una nueva evita el rate limit de emails de Supabase; el reseteo de contraseña vía `supabase db query --linked` puede estar bloqueado en sesiones de background/auto-mode, en cuyo caso avisar al usuario y esperar confirmación en vez de buscar un rodeo).

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Build limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, 11 páginas. Único error de `tsc` el preexistente de `ProgressList.tsx:162`.

- [ ] **Step 2: Matar procesos huérfanos antes de arrancar**

Run: `ps aux | grep -E "astro dev|astro preview|esbuild" | grep -v grep`
Matar cualquier proceso de una corrida anterior con `kill -9 <pid>`.

- [ ] **Step 3: Levantar el dev server**

```bash
npm run dev -- --port 4323 &
sleep 3
```
(Se usa `astro dev`, no `astro preview`, porque el Service Worker del spec 1 cachea agresivamente el HTML — con `preview` se corre el riesgo de servir una build vieja durante esta verificación.)

- [ ] **Step 4: Crear/editar entrenamientos offline y verificar el banner**

Con Playwright (`page.context().setOffline(true)`, loguear con la cuenta de prueba primero mientras `false`):
1. Loguear online, navegar a `/registro/nuevo/`, esperar a que cargue.
2. `setOffline(true)`.
3. Cargar una serie nueva (`addSet` via UI) y guardar — confirmar que no tira error visible y que el mensaje de guardado aparece igual que online.
4. Navegar a `/progreso/` (offline) — confirmar que el entrenamiento recién creado aparece en el historial (viene del caché parcheado optimistamente, no de un fetch).
5. Editar esa serie desde `WorkoutHistory` (offline) — confirmar que el cambio se refleja al instante.
6. Confirmar que el `SyncBanner` muestra "N cambios pendientes de sincronizar" en cualquier página.

- [ ] **Step 5: Reconectar y verificar que la cola se vacía**

1. `setOffline(false)`.
2. Esperar el evento `online` (Playwright lo dispara solo al cambiar `setOffline`) o forzar `window.dispatchEvent(new Event('online'))` si hace falta.
3. Esperar ~1s, confirmar que el banner desaparece.
4. Confirmar contra Supabase (`supabase db query --linked "select * from workout_sets order by created_at desc limit 5;"`) que el set creado offline y su edición llegaron con los valores finales correctos.

- [ ] **Step 6: Forzar un conflicto**

1. Con dos `BrowserContext` de Playwright distintos (misma cuenta, dos "dispositivos"), ambos cargan el mismo set.
2. Contexto A: `setOffline(true)`, editar el set (reps/peso distintos).
3. Contexto B: online, editar el mismo set con otros valores, guardar (llega al servidor).
4. Contexto A: `setOffline(false)`, esperar a que `flushQueue` corra.
5. Confirmar que el banner de A pasa a "1 conflicto — revisar", navegar a `/sincronizacion/`, confirmar que se ve "Vos: ..." vs. "Servidor: ..." con los valores correctos de cada contexto.
6. Probar "Mantener el mío" en un conflicto y "Descartar y usar el del servidor" en otro (si se generó más de uno) — confirmar que ambos botones funcionan sin error de consola y que el conflicto desaparece de la lista tras cada acción.

- [ ] **Step 7: Arranque en frío offline**

1. Nueva pestaña/contexto, loguear online una vez (para poblar el caché), cerrar.
2. Nuevo contexto, `setOffline(true)` desde el arranque, loguear (la sesión cacheada debería alcanzar) y navegar a `/registro/nuevo/`.
3. Confirmar que "Hoy toca" y las sugerencias de peso/reps aparecen (vienen del caché, no de un fetch que fallaría offline).

- [ ] **Step 8: Limpieza**

```bash
kill %1
ps aux | grep -E "astro dev|esbuild" | grep -v grep
```
Matar cualquier proceso que haya quedado colgado. Si se creó una cuenta de prueba nueva para esta verificación, dejarla (se reusa en la próxima sesión, según el patrón documentado) o borrarla con `supabase db query --linked "delete from auth.users where email = '...';"` si el usuario lo pide explícitamente.
