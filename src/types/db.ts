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
  updated_at: string;
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  days: RoutineDays;
  created_at: string;
  assigned_by_name: string | null;
}

export interface ActiveRoutine {
  user_id: string;
  source: 'predefined' | 'custom';
  routine_ref: string;
  started_at: string;
  duration_weeks: number;
  created_at: string;
}

export interface WorkoutSession {
  id: string;
  workout_id: string;
  activity_id: string;
  duration_min: number;
  distance_km: number | null;
  created_at: string;
  updated_at: string;
}

export interface Measurement {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
  height_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  created_at: string;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  accent_color: string;
  theme: 'light' | 'dark';
  is_trainer: boolean;
  updated_at: string;
}

export interface InviteCode {
  user_id: string;
  code: string;
  created_at: string;
}

export interface Connection {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
}

export interface PublicIdentity {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_trainer: boolean;
  updated_at: string;
}

export interface ConnectionRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface TrainerProfile {
  user_id: string;
  is_visible: boolean;
  lat: number | null;
  lng: number | null;
  disciplines: string[];
  bio: string | null;
  rate_amount: number | null;
  rate_currency: string | null;
  rate_period: 'clase' | 'mes' | 'hora' | null;
  updated_at: string;
}

export interface RoutineShare {
  id: string;
  routine_id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}
