import { supabase } from './supabase';
import type { Workout, WorkoutSet, WorkoutSession } from '../types/db';

export async function createWorkout(
  date: string,
  notes?: string,
  planId?: string
): Promise<Workout> {
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

export async function addSet(
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

export async function getWorkoutsForCurrentUser(): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .order('date', { ascending: false });

  if (error) throw error;
  return data as Workout[];
}

export async function getSetsForWorkout(workoutId: string): Promise<WorkoutSet[]> {
  const { data, error } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('workout_id', workoutId)
    .order('exercise_id', { ascending: true })
    .order('set_number', { ascending: true });

  if (error) throw error;
  return data as WorkoutSet[];
}

export async function addSession(
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

export async function getSessionsForWorkout(workoutId: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as WorkoutSession[];
}
