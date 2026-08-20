create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  plan_id text,
  notes text,
  created_at timestamptz not null default now()
);

create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id text not null,
  set_number integer not null,
  reps integer not null,
  weight numeric not null,
  rpe numeric,
  created_at timestamptz not null default now()
);

alter table workouts enable row level security;
alter table workout_sets enable row level security;

create policy "Users can manage their own workouts"
  on workouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage sets of their own workouts"
  on workout_sets for all
  using (
    exists (
      select 1 from workouts
      where workouts.id = workout_sets.workout_id
      and workouts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workouts
      where workouts.id = workout_sets.workout_id
      and workouts.user_id = auth.uid()
    )
  );

create index idx_workout_sets_workout_id on workout_sets(workout_id);

alter table workout_sets add constraint unique_set_number_per_workout unique(workout_id, exercise_id, set_number);

create table routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  days jsonb not null,
  created_at timestamptz not null default now()
);

alter table routines enable row level security;

create policy "Users can manage their own routines"
  on routines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table active_routines (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null check (source in ('predefined', 'custom')),
  routine_ref text not null,
  started_at date not null default current_date,
  duration_weeks integer not null check (duration_weeks > 0),
  created_at timestamptz not null default now()
);

alter table active_routines enable row level security;

create policy "Users can manage their own active routine"
  on active_routines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  activity_id text not null,
  duration_min numeric not null check (duration_min > 0),
  distance_km numeric check (distance_km > 0),
  created_at timestamptz not null default now()
);

alter table workout_sessions enable row level security;

create policy "Users can manage sessions of their own workouts"
  on workout_sessions for all
  using (
    exists (
      select 1 from workouts
      where workouts.id = workout_sessions.workout_id
      and workouts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workouts
      where workouts.id = workout_sessions.workout_id
      and workouts.user_id = auth.uid()
    )
  );

create index idx_workout_sessions_workout_id on workout_sessions(workout_id);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  weight_kg numeric,
  height_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  arm_cm numeric,
  leg_cm numeric,
  accent_color text not null default '#d7ff3f',
  theme text not null default 'dark' check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can manage their own profile"
  on profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public bucket: avatar URLs are read via plain <img src>, so anyone with the
-- URL can view an avatar (no private data in the image itself). Writes are
-- restricted per-user by the {user_id}/... path prefix.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- One row per user per day, upserted on save from Perfil — the history
-- powering the measurement progress chart on Progreso. `profiles` still
-- holds the latest snapshot for quick display; this table is what makes
-- that snapshot a trend instead of a single overwritten value.
create table measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric,
  height_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  arm_cm numeric,
  leg_cm numeric,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table measurements enable row level security;

create policy "Users can manage their own measurements"
  on measurements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_measurements_user_date on measurements(user_id, date);

-- updated_at + trigger para detección de conflictos en la sincronización
-- offline (docs/superpowers/specs/2026-08-16-logueo-offline-y-sync-design.md).
-- workouts no lo necesita: no tiene UPDATE hoy, solo DELETE.
alter table workout_sets add column updated_at timestamptz not null default now();
alter table workout_sessions add column updated_at timestamptz not null default now();

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workout_sets_set_updated_at before update on workout_sets
  for each row execute function set_updated_at();
create trigger workout_sessions_set_updated_at before update on workout_sessions
  for each row execute function set_updated_at();

-- Rol de entrenador + conexiones entre usuarios
-- (docs/superpowers/specs/2026-08-18-rol-entrenador-design.md).
alter table profiles add column is_trainer boolean not null default false;
alter table routines add column assigned_by_name text;

create table invite_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table invite_codes enable row level security;

create policy "Cualquiera puede buscar un código para redimirlo"
  on invite_codes for select
  using (true);

create policy "Un usuario crea su propio código"
  on invite_codes for insert
  with check (auth.uid() = user_id);

create policy "Un usuario puede regenerar su propio código"
  on invite_codes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table connections (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- user_a < user_b (no self-connection since < excludes equality, plus
  -- enforces canonical pair ordering so unique(user_a, user_b) catches a
  -- duplicate regardless of which side redeemed whose invite code — see
  -- docs/superpowers/specs/2026-08-18-rol-entrenador-design.md sección 1.
  -- Verificado empíricamente: la comparación uuid < de Postgres coincide
  -- con el orden de .sort() de JS sobre las mismas cadenas.
  constraint connections_ordered check (user_a < user_b),
  unique (user_a, user_b)
);

alter table connections enable row level security;

create policy "Los dos lados de una conexión pueden verla"
  on connections for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "Cualquiera puede conectarse a sí mismo con otro usuario"
  on connections for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

create policy "Cualquiera de los dos lados puede desvincularse"
  on connections for delete
  using (auth.uid() = user_a or auth.uid() = user_b);

-- No se agrega una política de select entre conexiones directamente sobre
-- profiles: RLS es por fila, no por columna — una política así expondría
-- también las medidas corporales a cualquier conexión. En su lugar,
-- public_identities es una tabla física separada que solo contiene los 3
-- campos no sensibles necesarios para identificar una conexión en la UI
-- (nombre, avatar, si es entrenador) — no hay ninguna columna sensible que
-- filtrar porque no existe en esta tabla.
create table public_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  is_trainer boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public_identities enable row level security;

create policy "Un usuario mantiene su propia identidad pública"
  on public_identities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuarios conectados pueden ver la identidad pública del otro"
  on public_identities for select
  using (
    exists (
      select 1 from connections
      where (connections.user_a = auth.uid() and connections.user_b = public_identities.user_id)
         or (connections.user_b = auth.uid() and connections.user_a = public_identities.user_id)
    )
  );

create policy "Un entrenador conectado puede crearle rutinas al otro"
  on routines for insert
  with check (
    exists (
      select 1 from profiles me
      join connections c
        on (c.user_a = auth.uid() and c.user_b = routines.user_id)
        or (c.user_b = auth.uid() and c.user_a = routines.user_id)
      where me.user_id = auth.uid() and me.is_trainer = true
    )
  );

-- Descubrimiento y conexiones entre usuarios
-- (docs/superpowers/specs/2026-08-18-descubrimiento-y-conexiones-design.md).

drop policy "Usuarios conectados pueden ver la identidad pública del otro" on public_identities;

create policy "Cualquier usuario autenticado puede buscar identidades públicas"
  on public_identities for select
  using (true);

create table connection_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint connection_requests_no_self check (from_user_id <> to_user_id),
  unique (from_user_id, to_user_id)
);

alter table connection_requests enable row level security;

create policy "Los dos lados de una solicitud pueden verla"
  on connection_requests for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Un usuario puede enviar una solicitud"
  on connection_requests for insert
  with check (auth.uid() = from_user_id);

create policy "El receptor puede aceptar o rechazar una solicitud"
  on connection_requests for update
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

create policy "Cualquiera de los dos lados puede cancelar una solicitud"
  on connection_requests for delete
  using ((auth.uid() = from_user_id or auth.uid() = to_user_id) and status = 'pending');

-- Sin esto, un receptor podría reapuntar `from_user_id` en su propia
-- solicitud pendiente a un tercero no involucrado y luego aceptarla,
-- forzando una fila en `connections` sin el consentimiento real de esa
-- persona — la política de UPDATE de arriba solo fija `to_user_id`
-- (auth.uid() = to_user_id en using/with check), no las demás columnas.
-- Ojo: un `revoke update (columna)` por sí solo NO alcanza acá — Supabase
-- ya le da a `authenticated` un `grant update` a nivel de tabla completa por
-- defecto en cualquier tabla nueva, y ese grant amplio sigue permitiendo
-- escribir cualquier columna sin importar qué se revoque a nivel de columna
-- (verificado empíricamente contra el proyecto real vía
-- information_schema.column_privileges). Hay que revocar el `update` de
-- tabla completa primero, y recién ahí otorgar `update` solo sobre la
-- columna que sí debe ser editable.
revoke update on connection_requests from authenticated;
grant update (status) on connection_requests to authenticated;

create table trainer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_visible boolean not null default false,
  lat double precision,
  lng double precision,
  disciplines text[] not null default '{}',
  bio text,
  rate_amount numeric,
  rate_currency text,
  rate_period text check (rate_period in ('clase', 'mes', 'hora')),
  updated_at timestamptz not null default now()
);

alter table trainer_profiles enable row level security;

create policy "Un entrenador administra su propio perfil de mapa"
  on trainer_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Cualquiera puede ver perfiles de entrenadores visibles"
  on trainer_profiles for select
  using (is_visible = true);

create table routine_shares (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint routine_shares_no_self check (from_user_id <> to_user_id)
);

alter table routine_shares enable row level security;

create policy "Los dos lados de una rutina compartida pueden verla"
  on routine_shares for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "El dueño conectado puede proponer compartir su rutina"
  on routine_shares for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from routines
      where routines.id = routine_id and routines.user_id = auth.uid()
    )
    and exists (
      select 1 from connections
      where (connections.user_a = auth.uid() and connections.user_b = to_user_id)
         or (connections.user_b = auth.uid() and connections.user_a = to_user_id)
    )
  );

create policy "El receptor puede aceptar o rechazar la propuesta"
  on routine_shares for update
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

create policy "Quien propuso puede cancelarla mientras esté pendiente"
  on routine_shares for delete
  using (auth.uid() = from_user_id and status = 'pending');

-- Mismo motivo que la línea equivalente sobre connection_requests más
-- arriba: sin esto, el receptor de una propuesta pendiente podría reapuntar
-- `routine_id`/`from_user_id` a una fila arbitraria y ganar lectura sobre
-- una rutina ajena vía la política de "El receptor de una rutina compartida
-- pendiente puede verla" que sigue debajo — esa política de SELECT sobre
-- `routines` confía en `routine_shares.routine_id` sin poder saber si fue
-- manipulado después del insert original. Mismo patrón revoke-total +
-- grant-parcial que arriba (ver esa nota): un revoke solo de columna no
-- alcanza contra el grant de tabla completa que Supabase ya le da a
-- `authenticated` por defecto.
revoke update on routine_shares from authenticated;
grant update (status) on routine_shares to authenticated;

create policy "El receptor de una rutina compartida pendiente puede verla"
  on routines for select
  using (
    exists (
      select 1 from routine_shares
      where routine_shares.routine_id = routines.id
        and routine_shares.to_user_id = auth.uid()
        and routine_shares.status = 'pending'
    )
  );

-- Fix: reenviar una solicitud de conexión después de desvincularse quedaba
-- descartado en silencio. Encontrado en la verificación manual E2E final
-- (Task 11 del plan de descubrimiento y conexiones), caso "solicitudes
-- simultáneas": `sendConnectionRequest` inserta con
-- `unique(from_user_id, to_user_id)`, y ante un conflicto (23505) asumía que
-- ya había una solicitud pendiente idéntica (no-op inofensivo) — pero si la
-- fila existente ya estaba en 'accepted' (de una conexión ya desvinculada),
-- el remitente no podía tocarla: la política de UPDATE de arriba solo
-- dejaba escribir al receptor (`to_user_id = auth.uid()`), y la de DELETE
-- exige `status = 'pending'`. El conflicto se tragaba en silencio y la UI
-- mostraba "Solicitud enviada" sin haber mandado nada de verdad.
-- Fix: el remitente también puede reactivar su propia fila a 'pending',
-- pero únicamente si estaba en 'accepted' — nunca desde 'rejected'. Una
-- primera versión de este fix (durante la misma verificación E2E) permitía
-- reactivar desde cualquier estado, incluido 'rejected', lo que anulaba en
-- silencio el rechazo explícito del receptor con solo tocar "Conectar" de
-- nuevo — exactamente el vector de spam que la política de DELETE
-- (`status = 'pending'`, ver más arriba en este archivo) ya existía para
-- evitar. Corregido acá antes de que este spec quedara cerrado.
drop policy "El receptor puede aceptar o rechazar una solicitud" on connection_requests;
drop policy if exists "El receptor decide, el remitente puede reintentar" on connection_requests;

create policy "El receptor decide, el remitente puede reconectar tras desvincularse"
  on connection_requests for update
  using (auth.uid() = to_user_id or (auth.uid() = from_user_id and status = 'accepted'))
  with check (
    auth.uid() = to_user_id
    or (auth.uid() = from_user_id and status = 'pending')
  );

-- Perfil enriquecido: nivel de entrenamiento y sexo
-- (docs/superpowers/specs/2026-08-19-perfil-enriquecido-nivel-sexo-design.md).
-- Ambas nullable, sin default — un perfil sin completar queda simplemente
-- sin recomendación de rutina por esa señal, nunca bloquea nada.
alter table profiles add column sex text check (sex in ('femenino', 'masculino'));
alter table profiles add column training_level text check (training_level in ('principiante', 'intermedio', 'avanzado'));
