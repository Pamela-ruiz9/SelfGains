import { supabase } from './supabase';
import type { ActiveRoutine, Routine } from '../types/db';
import type { RoutineDays } from './weekdays';
import { isNetworkError, readCache, writeCache } from './offlineQueue';

export async function createRoutine(name: string, days: RoutineDays): Promise<Routine> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('routines')
    .insert({ user_id: user.id, name, days })
    .select()
    .single();

  if (error) throw error;
  return data as Routine;
}

export async function getMyRoutines(): Promise<Routine[]> {
  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Routine[];
}

export async function getRoutineById(id: string): Promise<Routine | null> {
  try {
    const { data, error } = await supabase.from('routines').select('*').eq('id', id).maybeSingle().retry(false);
    if (error) throw error;
    const result = data as Routine | null;
    await writeCache(`routine:${id}`, result);
    return result;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return await readCache<Routine | null>(`routine:${id}`);
  }
}

export async function activateRoutine(
  source: 'predefined' | 'custom',
  routineRef: string,
  durationWeeks: number
): Promise<ActiveRoutine> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('active_routines')
    .upsert({
      user_id: user.id,
      source,
      routine_ref: routineRef,
      started_at: new Date().toISOString().slice(0, 10),
      duration_weeks: durationWeeks,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ActiveRoutine;
}

export async function getActiveRoutine(): Promise<ActiveRoutine | null> {
  try {
    // .retry(false): sin esto, offline recién falla después de reintentar
    // varias veces con backoff exponencial — ver el mismo comentario en
    // src/lib/workouts.ts (getWorkoutsRemote).
    const { data, error } = await supabase.from('active_routines').select('*').maybeSingle().retry(false);
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

export async function updateRoutine(id: string, name: string, days: RoutineDays): Promise<Routine> {
  const { data, error } = await supabase
    .from('routines')
    .update({ name, days })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Routine;
}

export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await supabase.from('routines').delete().eq('id', id);
  if (error) throw error;
}

export async function deactivateRoutine(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { error } = await supabase.from('active_routines').delete().eq('user_id', user.id);
  if (error) throw error;
}

export async function assignRoutineToStudent(routineId: string, studentUserId: string): Promise<Routine> {
  const source = await getRoutineById(routineId);
  if (!source) throw new Error('No se encontró la rutina a asignar.');

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .maybeSingle();

  const { data, error } = await supabase
    .from('routines')
    .insert({
      user_id: studentUserId,
      name: source.name,
      days: source.days,
      assigned_by_name: myProfile?.display_name ?? 'tu entrenador',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Routine;
}

export function weeksElapsed(startedAt: string): number {
  return Math.floor(daysElapsed(startedAt) / 7);
}

export function daysElapsed(startedAt: string): number {
  const start = new Date(`${startedAt}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((Date.now() - start.getTime()) / msPerDay);
}
