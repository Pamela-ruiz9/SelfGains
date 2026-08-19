import { supabase } from './supabase';
import type { TrainerProfile } from '../types/db';

// Ciudad de México como centro por defecto del mapa cuando no hay
// geolocalización ni pin propio todavía.
export const DEFAULT_MAP_CENTER: [number, number] = [19.4326, -99.1332];

export async function getMyTrainerProfile(): Promise<TrainerProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('trainer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
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
  status: 'connected' | 'request-sent' | 'request-received' | 'none';
  requestId: string | null;
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('trainer_profiles')
    .select('*')
    .eq('is_visible', true)
    .neq('user_id', user.id)
    .not('lat', 'is', null)
    .not('lng', 'is', null);
  if (error) throw error;
  const rows = (data ?? []) as TrainerProfile[];
  if (rows.length === 0) return [];

  // Mismo cálculo de estado que searchUsers en connectionRequests.ts (no se
  // importa desde ahí para no crear una dependencia cruzada entre los dos
  // módulos por una lógica de ~15 líneas — ver docs/agents/notas-de-entorno-y-lecciones.md
  // sobre preferir alguna duplicación acotada a una abstracción prematura).
  const [{ data: identities, error: identitiesError }, { data: connectionRows, error: connError }, { data: requestRows, error: reqError }] =
    await Promise.all([
      supabase
        .from('public_identities')
        .select('user_id, display_name, avatar_url')
        .in(
          'user_id',
          rows.map((r) => r.user_id)
        ),
      supabase
        .from('connections')
        .select('user_a, user_b')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      supabase
        .from('connection_requests')
        .select('id, from_user_id, to_user_id')
        .eq('status', 'pending')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
    ]);
  if (identitiesError) throw identitiesError;
  if (connError) throw connError;
  if (reqError) throw reqError;

  const identityById = new Map(
    (identities as { user_id: string; display_name: string | null; avatar_url: string | null }[]).map(
      (p) => [p.user_id, p]
    )
  );
  const connectedIds = new Set(
    (connectionRows as { user_a: string; user_b: string }[]).map((c) =>
      c.user_a === user.id ? c.user_b : c.user_a
    )
  );
  const requests = (requestRows ?? []) as { id: string; from_user_id: string; to_user_id: string }[];

  return rows
    .map((r) => {
      const identity = identityById.get(r.user_id);
      let status: VisibleTrainer['status'] = 'none';
      let requestId: string | null = null;
      if (connectedIds.has(r.user_id)) {
        status = 'connected';
      } else {
        const outgoing = requests.find((req) => req.from_user_id === user.id && req.to_user_id === r.user_id);
        if (outgoing) {
          status = 'request-sent';
          requestId = outgoing.id;
        } else {
          const incoming = requests.find((req) => req.to_user_id === user.id && req.from_user_id === r.user_id);
          if (incoming) {
            status = 'request-received';
            requestId = incoming.id;
          }
        }
      }
      return {
        ...r,
        displayName: identity?.display_name ?? null,
        avatarUrl: identity?.avatar_url ?? null,
        distanceKm: distanceKm(centerLat, centerLng, r.lat as number, r.lng as number),
        status,
        requestId,
      };
    })
    .filter((t) => t.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
