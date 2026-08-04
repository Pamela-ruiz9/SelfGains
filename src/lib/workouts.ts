import { supabase } from './supabase';
import type { Workout, WorkoutSet } from '../types/db';

export async function createWorkout(date: string, notes?: string): Promise<Workout> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: user.id, date, notes: notes ?? null })
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
    .order('set_number', { ascending: true });

  if (error) throw error;
  return data as WorkoutSet[];
}
