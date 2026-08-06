import type { RoutineDays } from '../lib/weekdays';

export interface Workout {
  id: string;
  user_id: string;
  date: string;
  plan_id: string | null;
  notes: string | null;
  created_at: string;
}

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

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  days: RoutineDays;
  created_at: string;
}

export interface ActiveRoutine {
  user_id: string;
  source: 'predefined' | 'custom';
  routine_ref: string;
  started_at: string;
  duration_weeks: number;
  created_at: string;
}
