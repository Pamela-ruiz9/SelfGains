import { supabase } from './supabase';
import type { PublicIdentity } from '../types/db';

export interface SearchResult {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  isTrainer: boolean;
  status: 'connected' | 'request-sent' | 'request-received' | 'none';
  requestId: string | null;
}

export async function searchUsers(query: string): Promise<SearchResult[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const { data: identities, error } = await supabase
    .from('public_identities')
    .select('user_id, display_name, avatar_url, is_trainer')
    .ilike('display_name', `%${trimmed}%`)
    .neq('user_id', user.id)
    .limit(20);
  if (error) throw error;
  const rows = (identities ?? []) as PublicIdentity[];
  if (rows.length === 0) return [];

  const { data: connectionRows, error: connError } = await supabase
    .from('connections')
    .select('user_a, user_b')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
  if (connError) throw connError;
  const connectedIds = new Set(
    (connectionRows as { user_a: string; user_b: string }[]).map((c) =>
      c.user_a === user.id ? c.user_b : c.user_a
    )
  );

  const { data: requestRows, error: reqError } = await supabase
    .from('connection_requests')
    .select('id, from_user_id, to_user_id')
    .eq('status', 'pending')
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
  if (reqError) throw reqError;
  const requests = (requestRows ?? []) as { id: string; from_user_id: string; to_user_id: string }[];

  return rows.map((r): SearchResult => {
    if (connectedIds.has(r.user_id)) {
      return {
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        isTrainer: r.is_trainer,
        status: 'connected',
        requestId: null,
      };
    }
    const outgoing = requests.find((req) => req.from_user_id === user.id && req.to_user_id === r.user_id);
    if (outgoing) {
      return {
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        isTrainer: r.is_trainer,
        status: 'request-sent',
        requestId: outgoing.id,
      };
    }
    const incoming = requests.find((req) => req.to_user_id === user.id && req.from_user_id === r.user_id);
    if (incoming) {
      return {
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        isTrainer: r.is_trainer,
        status: 'request-received',
        requestId: incoming.id,
      };
    }
    return {
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      isTrainer: r.is_trainer,
      status: 'none',
      requestId: null,
    };
  });
}

export interface IncomingRequest {
  requestId: string;
  fromUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  isTrainer: boolean;
}

export async function getIncomingRequests(): Promise<IncomingRequest[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('connection_requests')
    .select('id, from_user_id')
    .eq('to_user_id', user.id)
    .eq('status', 'pending');
  if (error) throw error;
  const rows = (data ?? []) as { id: string; from_user_id: string }[];
  if (rows.length === 0) return [];

  const { data: identities, error: identitiesError } = await supabase
    .from('public_identities')
    .select('user_id, display_name, avatar_url, is_trainer')
    .in(
      'user_id',
      rows.map((r) => r.from_user_id)
    );
  if (identitiesError) throw identitiesError;
  const identityById = new Map((identities as PublicIdentity[]).map((p) => [p.user_id, p]));

  return rows.map((r) => {
    const identity = identityById.get(r.from_user_id);
    return {
      requestId: r.id,
      fromUserId: r.from_user_id,
      displayName: identity?.display_name ?? null,
      avatarUrl: identity?.avatar_url ?? null,
      isTrainer: identity?.is_trainer ?? false,
    };
  });
}

export async function sendConnectionRequest(toUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { error } = await supabase
    .from('connection_requests')
    .insert({ from_user_id: user.id, to_user_id: toUserId });

  if (!error) return;
  if (error.code !== '23505') throw error;

  // Ya existe una fila para este par (from_user_id, to_user_id) — puede ser
  // una solicitud pendiente (doble click, no-op real) o una fila 'accepted'
  // de una conexión ya desvinculada, que el remitente no podía tocar de otra
  // forma (la política de DELETE exige status = 'pending', y solo el
  // receptor podía hacer UPDATE). Sin este paso, un segundo intento en la
  // misma dirección quedaba descartado en silencio para siempre por la
  // restricción unique, con la UI mostrando "Solicitud enviada" sin que se
  // mandara nada de verdad — ver docs/agents/notas-de-entorno-y-lecciones.md.
  //
  // La política de RLS solo deja reactivar una fila 'accepted' (no una
  // 'rejected' — un rechazo explícito del receptor es definitivo, mismo
  // motivo por el que la política de DELETE exige status = 'pending'). Si la
  // fila estaba 'rejected', este update no toca ninguna fila (RLS la
  // bloquea) y no tira error — hay que revisar explícitamente si algo se
  // actualizó de verdad para no mostrar un falso "enviada".
  const { data: revived, error: reviveError } = await supabase
    .from('connection_requests')
    .update({ status: 'pending' })
    .eq('from_user_id', user.id)
    .eq('to_user_id', toUserId)
    .select('id');
  if (reviveError) throw reviveError;
  if (!revived || revived.length === 0) {
    throw new Error('Esa persona ya rechazó tu solicitud.');
  }
}

export async function acceptConnectionRequest(requestId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error: updateError } = await supabase
    .from('connection_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .eq('to_user_id', user.id)
    .select('from_user_id')
    .single();
  if (updateError) throw updateError;

  // Mismo orden canónico y manejo de duplicado que redeemInviteCode en
  // src/lib/connections.ts.
  const [userA, userB] = [data.from_user_id, user.id].sort();
  const { error: insertError } = await supabase.from('connections').insert({ user_a: userA, user_b: userB });
  if (insertError && insertError.code !== '23505') throw insertError;
}

export async function rejectConnectionRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('connection_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId);
  if (error) throw error;
}
