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
    const patchedPayload: Record<string, unknown> = { ...pending.payload, reps, weight, rpe: rpe ?? null };
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

async function findQueuedUpdate(
  type: 'updateSet' | 'updateSession',
  idKey: 'setId' | 'sessionId',
  id: string
): Promise<QueueItem | undefined> {
  const items = await getQueueItems();
  return items.find((i) => i.type === type && (i.payload as Record<string, unknown>)[idKey] === id);
}

async function cancelDependentQueueItems(tempId: string): Promise<void> {
  const items = await getQueueItems();
  for (const item of items) {
    if (item.dependsOnTempId === tempId) {
      await removeQueueItem(item.id!);
    }
  }
}

async function queueUpdateSet(setId: string, reps: number, weight: number, rpe?: number): Promise<WorkoutSet> {
  const workoutId = await lookupSetWorkout(setId);
  const cached = workoutId ? ((await readCache<WorkoutSet[]>(`sets:${workoutId}`)) ?? []) : [];
  const existing = cached.find((s) => s.id === setId);

  const pendingUpdate = await findQueuedUpdate('updateSet', 'setId', setId);
  if (pendingUpdate) {
    // Ya hay una edición offline de este mismo set en cola — se actualizan
    // los valores pero se conserva el snapshotUpdatedAt original (el último
    // valor confirmado por el servidor), para no generar un conflicto falso
    // contra el propio cambio anterior todavía sin sincronizar.
    await updateQueueItem(pendingUpdate.id!, {
      payload: { ...pendingUpdate.payload, reps, weight, rpe: rpe ?? null },
    });
  } else {
    await enqueue({
      type: 'updateSet',
      payload: { setId, workoutId, reps, weight, rpe: rpe ?? null },
      snapshotUpdatedAt: existing?.updated_at,
    });
  }

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
    const patchedPayload: Record<string, unknown> = { ...pending.payload, durationMin, distanceKm: distanceKm ?? null };
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

  const pendingUpdate = await findQueuedUpdate('updateSession', 'sessionId', sessionId);
  if (pendingUpdate) {
    await updateQueueItem(pendingUpdate.id!, {
      payload: { ...pendingUpdate.payload, durationMin, distanceKm: distanceKm ?? null },
    });
  } else {
    await enqueue({
      type: 'updateSession',
      payload: { sessionId, workoutId, durationMin, distanceKm: distanceKm ?? null },
      snapshotUpdatedAt: existing?.updated_at,
    });
  }

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
    await cancelDependentQueueItems(workoutId);
    const userId = pending.payload.userId as string | undefined;
    if (userId) {
      await patchCacheArray<Workout>(`workouts:${userId}`, (items) => items.filter((w) => w.id !== workoutId));
    }
    await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, () => []);
    await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, () => []);
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

let flushInFlight: Promise<void> | null = null;

export function flushQueue(): Promise<void> {
  if (!flushInFlight) {
    flushInFlight = runFlushQueue().finally(() => {
      flushInFlight = null;
    });
  }
  return flushInFlight;
}

async function runFlushQueue(): Promise<void> {
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
        if (item.dependsOnTempId) {
          // El set se cacheó bajo la clave temporal del workout padre
          // (todavía no sincronizado cuando se encoló) — migrar esa entrada
          // puntual a la clave real en vez de patchear una clave nueva vacía.
          await patchCacheArray<WorkoutSet>(`sets:${item.dependsOnTempId}`, (items) =>
            items.filter((s) => s.id !== item.tempId)
          );
          await patchCacheArray<WorkoutSet>(`sets:${realWorkoutId}`, (items) => [...items, set]);
        } else {
          await patchCacheArray<WorkoutSet>(`sets:${realWorkoutId}`, (items) =>
            items.map((s) => (s.id === item.tempId ? set : s))
          );
        }
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
        if (item.dependsOnTempId) {
          await patchCacheArray<WorkoutSession>(`sessions:${item.dependsOnTempId}`, (items) =>
            items.filter((s) => s.id !== item.tempId)
          );
          await patchCacheArray<WorkoutSession>(`sessions:${realWorkoutId}`, (items) => [...items, session]);
        } else {
          await patchCacheArray<WorkoutSession>(`sessions:${realWorkoutId}`, (items) =>
            items.map((s) => (s.id === item.tempId ? session : s))
          );
        }
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
    // vez de trabar el resto de la cola — ver sección 3.7 y 4 del spec. Se
    // deja un log porque este mismo camino también captura bugs reales, no
    // solo conflictos legítimos, y así queda un rastro para diagnosticarlos.
    console.error('[selfgains] no se pudo sincronizar un cambio offline, se guarda como conflicto', item, err);
    if (item.tempId) await cancelDependentQueueItems(item.tempId);
    await addConflict(item, null);
    return 'ok';
  }
  return 'ok';
}
