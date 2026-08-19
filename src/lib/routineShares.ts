import { supabase } from './supabase';
import type { Routine } from '../types/db';

export async function proposeRoutineShare(routineId: string, toUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { error } = await supabase
    .from('routine_shares')
    .insert({ routine_id: routineId, from_user_id: user.id, to_user_id: toUserId });
  if (error) throw error;
}

export interface PendingRoutineShare {
  shareId: string;
  routineId: string;
  routineName: string;
  fromUserId: string;
  fromDisplayName: string | null;
}

export async function getPendingRoutineShares(): Promise<PendingRoutineShare[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('routine_shares')
    .select('id, routine_id, from_user_id')
    .eq('to_user_id', user.id)
    .eq('status', 'pending');
  if (error) throw error;
  const rows = (data ?? []) as { id: string; routine_id: string; from_user_id: string }[];
  if (rows.length === 0) return [];

  const [{ data: routines, error: routinesError }, { data: identities, error: identitiesError }] =
    await Promise.all([
      supabase
        .from('routines')
        .select('id, name')
        .in(
          'id',
          rows.map((r) => r.routine_id)
        ),
      supabase
        .from('public_identities')
        .select('user_id, display_name')
        .in(
          'user_id',
          rows.map((r) => r.from_user_id)
        ),
    ]);
  if (routinesError) throw routinesError;
  if (identitiesError) throw identitiesError;

  const routineById = new Map((routines as { id: string; name: string }[]).map((r) => [r.id, r.name]));
  const nameById = new Map(
    (identities as { user_id: string; display_name: string | null }[]).map((p) => [p.user_id, p.display_name])
  );

  return rows.map((r) => ({
    shareId: r.id,
    routineId: r.routine_id,
    routineName: routineById.get(r.routine_id) ?? 'Rutina',
    fromUserId: r.from_user_id,
    fromDisplayName: nameById.get(r.from_user_id) ?? null,
  }));
}

export async function getSharedRoutinePreview(routineId: string): Promise<Routine | null> {
  const { data, error } = await supabase.from('routines').select('*').eq('id', routineId).maybeSingle();
  if (error) throw error;
  return data as Routine | null;
}

export async function acceptRoutineShare(shareId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  // Se lee `routine_id` de la propia fila de la propuesta (acotado a
  // `to_user_id = auth.uid()` y `status = 'pending'`) en vez de confiarlo
  // como parámetro — mismo motivo que la corrección de
  // acceptConnectionRequest en src/lib/connectionRequests.ts: sin esto,
  // alguien podría pasar un shareId y un routineId que no se correspondan
  // entre sí y terminar marcando como aceptada una propuesta distinta de
  // la rutina que realmente copió.
  const { data: share, error: shareError } = await supabase
    .from('routine_shares')
    .select('routine_id')
    .eq('id', shareId)
    .eq('to_user_id', user.id)
    .eq('status', 'pending')
    .single();
  if (shareError) throw shareError;

  const source = await getSharedRoutinePreview(share.routine_id);
  if (!source) throw new Error('No se encontró la rutina compartida.');

  // Sin .select() después del insert, mismo motivo que
  // assignRoutineToStudent en src/lib/routines.ts: nada del lado del
  // cliente necesita la fila de vuelta.
  const { error: insertError } = await supabase
    .from('routines')
    .insert({ user_id: user.id, name: source.name, days: source.days });
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from('routine_shares')
    .update({ status: 'accepted' })
    .eq('id', shareId);
  if (updateError) throw updateError;
}

export async function rejectRoutineShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('routine_shares').update({ status: 'rejected' }).eq('id', shareId);
  if (error) throw error;
}
