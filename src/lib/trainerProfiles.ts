import { supabase } from './supabase';
import type { TrainerProfile } from '../types/db';

// Buenos Aires como centro por defecto del mapa cuando no hay geolocalización
// ni pin propio todavía — razonable dado que la copy de la app es en español
// rioplatense.
export const DEFAULT_MAP_CENTER: [number, number] = [-34.6037, -58.3816];

export async function getMyTrainerProfile(): Promise<TrainerProfile | null> {
  const { data, error } = await supabase.from('trainer_profiles').select('*').maybeSingle();
  if (error) throw error;
  return data as TrainerProfile | null;
}

export async function upsertTrainerProfile(
  changes: Partial<Omit<TrainerProfile, 'user_id' | 'updated_at'>>
): Promise<TrainerProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('trainer_profiles')
    .upsert({ user_id: user.id, ...changes, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data as TrainerProfile;
}

export interface VisibleTrainer extends TrainerProfile {
  displayName: string | null;
  avatarUrl: string | null;
  distanceKm: number;
}

// Fórmula de Haversine — el proyecto no usa funciones RPC de Postgres ni
// PostGIS, así que la distancia se calcula acá una vez que los
// trainer_profiles visibles ya llegaron completos al cliente.
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getVisibleTrainersNear(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): Promise<VisibleTrainer[]> {
  const { data, error } = await supabase
    .from('trainer_profiles')
    .select('*')
    .eq('is_visible', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null);
  if (error) throw error;
  const rows = (data ?? []) as TrainerProfile[];
  if (rows.length === 0) return [];

  const { data: identities, error: identitiesError } = await supabase
    .from('public_identities')
    .select('user_id, display_name, avatar_url')
    .in(
      'user_id',
      rows.map((r) => r.user_id)
    );
  if (identitiesError) throw identitiesError;
  const identityById = new Map(
    (identities as { user_id: string; display_name: string | null; avatar_url: string | null }[]).map(
      (p) => [p.user_id, p]
    )
  );

  return rows
    .map((r) => {
      const identity = identityById.get(r.user_id);
      return {
        ...r,
        displayName: identity?.display_name ?? null,
        avatarUrl: identity?.avatar_url ?? null,
        distanceKm: distanceKm(centerLat, centerLng, r.lat as number, r.lng as number),
      };
    })
    .filter((t) => t.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
