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
  if (error) {
    if (error.code === '23505') throw new Error('Ya le propusiste esta rutina y sigue pendiente.');
    throw error;
  }
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

  // Reclama la propuesta atómicamente antes de copiar nada: el UPDATE
  // condicional (.eq('status', 'pending')) solo puede afectar la fila una
  // vez, así que si dos llamadas concurrentes (doble click, dos pestañas)
  // llegan acá al mismo tiempo, como mucho una gana y sigue — la otra ve 0
  // filas afectadas y aborta antes de insertar ninguna copia de la rutina.
  // Reemplaza al SELECT que existía antes: el mismo UPDATE ya devuelve
  // routine_id, scoped a to_user_id = auth.uid() (mismo motivo que antes:
  // sin este scoping, alguien podría pasar un shareId ajeno).
  const { data: claimed, error: claimError } = await supabase
    .from('routine_shares')
    .update({ status: 'accepted' })
    .eq('id', shareId)
    .eq('to_user_id', user.id)
    .eq('status', 'pending')
    .select('routine_id')
    .single();
  if (claimError) throw new Error('Esta propuesta ya se resolvió en otro lado.');

  const source = await getSharedRoutinePreview(claimed.routine_id);
  if (!source) {
    // Revertir el reclamo: sin esto, la propuesta quedaría "accepted" para
    // siempre sin que el usuario tenga la rutina copiada, sin forma de
    // reintentar. Guardado con .eq('status', 'accepted') igual que el
    // reclamo original — nunca una escritura ciega — para no pisar un
    // rechazo que haya llegado desde otra pestaña en esta misma ventana.
    await supabase
      .from('routine_shares')
      .update({ status: 'pending' })
      .eq('id', shareId)
      .eq('status', 'accepted');
    throw new Error('No se encontró la rutina compartida.');
  }

  // Sin .select() después del insert, mismo motivo que
  // assignRoutineToStudent en src/lib/routines.ts: nada del lado del
  // cliente necesita la fila de vuelta.
  const { error: insertError } = await supabase
    .from('routines')
    .insert({ user_id: user.id, name: source.name, days: source.days });
  if (insertError) {
    await supabase
      .from('routine_shares')
      .update({ status: 'pending' })
      .eq('id', shareId)
      .eq('status', 'accepted');
    throw insertError;
  }
}

export async function rejectRoutineShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('routine_shares').update({ status: 'rejected' }).eq('id', shareId);
  if (error) throw error;
}
