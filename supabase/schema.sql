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
