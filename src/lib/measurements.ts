import { supabase } from './supabase';
import type { Measurement } from '../types/db';

export async function getMyMeasurements(): Promise<Measurement[]> {
  const { data, error } = await supabase
    .from('measurements')
    .select('*')
    .order('date', { ascending: true });

  if (error) throw error;
  return data as Measurement[];
}

// Upserts on (user_id, date) — saving twice on the same day updates that
// day's entry instead of creating a duplicate history point.
export async function logMeasurement(
  changes: Partial<Omit<Measurement, 'id' | 'user_id' | 'date' | 'created_at'>>
): Promise<Measurement> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('measurements')
    .upsert({ user_id: user.id, date, ...changes }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) throw error;
  return data as Measurement;
}
