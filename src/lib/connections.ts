import { supabase } from './supabase';
import type { PublicIdentity } from '../types/db';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export async function getMyInviteCode(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('invite_codes')
    .select('code')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.code ?? null;
}

export async function createOrRegenerateInviteCode(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from('invite_codes').upsert({ user_id: user.id, code });
    if (!error) return code;
    if (error.code !== '23505') throw error; // no es una colisión de código único, algo más falló
  }
  throw new Error('No se pudo generar un código único, prueba de nuevo.');
}

export async function redeemInviteCode(rawCode: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error('Código inválido.');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data: invite, error: inviteError } = await supabase
    .from('invite_codes')
    .select('user_id')
    .eq('code', code)
    .maybeSingle();

  if (inviteError) throw inviteError;
  if (!invite) throw new Error('Código inválido.');
  if (invite.user_id === user.id) throw new Error('No puedes conectarte contigo mismo.');

  // Orden canónico (alfabético) de los dos ids — no "quién generó el código"
  // — para que la restricción unique(user_a, user_b) detecte una conexión
  // ya existente sin importar quién redimió el código de quién.
  const [userA, userB] = [invite.user_id, user.id].sort();

  const { error } = await supabase.from('connections').insert({ user_a: userA, user_b: userB });

  // Ya conectados: el insert falla por la restricción unique — no es un
  // error real, la conexión ya existe, seguimos igual.
  if (error && error.code !== '23505') throw error;
}

export interface ConnectionSummary {
  connectionId: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  isTrainer: boolean;
}

export async function getMyConnections(): Promise<ConnectionSummary[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('connections')
    .select('id, user_a, user_b')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

  if (error) throw error;
  const rows = (data ?? []) as { id: string; user_a: string; user_b: string }[];
  if (rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.user_a === user.id ? r.user_b : r.user_a));
  // public_identities, no profiles: es la única tabla que la política de
  // RLS "Usuarios conectados pueden ver la identidad pública del otro"
  // permite leer entre conexiones — profiles completo (con medidas
  // corporales) nunca es legible fuera del dueño.
  const { data: identities, error: identitiesError } = await supabase
    .from('public_identities')
    .select('user_id, display_name, avatar_url, is_trainer')
    .in('user_id', otherIds);

  if (identitiesError) throw identitiesError;
  const identityById = new Map((identities as PublicIdentity[]).map((p) => [p.user_id, p]));

  return rows.map((r) => {
    const otherId = r.user_a === user.id ? r.user_b : r.user_a;
    const identity = identityById.get(otherId);
    return {
      connectionId: r.id,
      userId: otherId,
      displayName: identity?.display_name ?? null,
      avatarUrl: identity?.avatar_url ?? null,
      isTrainer: identity?.is_trainer ?? false,
    };
  });
}

export async function removeConnection(connectionId: string): Promise<void> {
  const { error } = await supabase.from('connections').delete().eq('id', connectionId);
  if (error) throw error;
}
