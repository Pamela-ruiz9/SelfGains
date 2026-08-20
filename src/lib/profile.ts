import { supabase } from './supabase';
import type { Profile } from '../types/db';

export async function getMyProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function upsertProfile(
  changes: Partial<Omit<Profile, 'user_id' | 'updated_at'>>
): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ user_id: user.id, ...changes, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  const profile = data as Profile;

  // public_identities es lo único que una conexión puede leer del otro lado
  // (ver docs/superpowers/specs/2026-08-18-rol-entrenador-design.md sección
  // 1) — se mantiene en espejo acá para que nunca quede desactualizada
  // respecto al nombre/avatar/rol reales en `profiles`.

  // sex/training_level NO se agregan acá a propósito: son datos privados
  // de perfil que ninguna conexión (ni un entrenador conectado) puede leer
  // — ver docs/superpowers/specs/2026-08-19-perfil-enriquecido-nivel-sexo-design.md
  // y la nota de seguridad de docs/agents/rol-entrenador-status.md sobre
  // por qué `public_identities` existe separada de `profiles`.
  const { error: identityError } = await supabase.from('public_identities').upsert({
    user_id: user.id,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    is_trainer: profile.is_trainer,
    updated_at: profile.updated_at,
  });
  if (identityError) throw identityError;

  return profile;
}

// Always stored at a fixed path per user ({user_id}/avatar.<ext>) with
// upsert:true, so a re-upload overwrites the previous file instead of
// accumulating orphaned images — the storage RLS policies key off that same
// {user_id}/... path prefix.
export async function uploadAvatar(file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${user.id}/avatar.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust: the path is stable across re-uploads, so without this the
  // browser (and any cached <img>) would keep showing the old photo.
  return `${data.publicUrl}?t=${Date.now()}`;
}
