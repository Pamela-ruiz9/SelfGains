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
