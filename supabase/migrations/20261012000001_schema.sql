-- =====================================================================
-- Geoffroy Fitness Training — schéma initial
-- Toutes les tables portent un coach_id (propriétaire) rempli
-- automatiquement avec auth.uid() et protégé par Row Level Security.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Fonction utilitaire : mise à jour automatique de updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- CLIENTS
-- ---------------------------------------------------------------------
create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  coach_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first_name         text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name          text not null check (char_length(trim(last_name)) between 1 and 80),
  goal               text check (char_length(goal) <= 200),
  level              text check (level in ('debutant', 'intermediaire', 'avance')),
  sessions_per_week  smallint check (sessions_per_week between 0 and 14),
  constraints        text check (char_length(constraints) <= 4000),
  notes              text check (char_length(notes) <= 8000),
  archived           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index clients_coach_idx on public.clients (coach_id, archived, last_name);

-- ---------------------------------------------------------------------
-- BIBLIOTHÈQUE D'EXERCICES (fiche générale, indépendante des programmes)
-- ---------------------------------------------------------------------
create table public.exercises (
  id               uuid primary key default gen_random_uuid(),
  coach_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 1 and 120),
  muscle_group     text check (char_length(muscle_group) <= 60),
  equipment        text check (char_length(equipment) <= 60),
  movement_type    text check (char_length(movement_type) <= 60),
  description      text check (char_length(description) <= 4000),
  execution_cues   text check (char_length(execution_cues) <= 4000),
  common_mistakes  text check (char_length(common_mistakes) <= 4000),
  variations       text check (char_length(variations) <= 2000),
  video_url        text check (video_url is null or video_url ~* '^https?://'),
  notes            text check (char_length(notes) <= 4000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index exercises_coach_idx on public.exercises (coach_id, name);

-- ---------------------------------------------------------------------
-- PROGRAMMES (un client peut en avoir plusieurs ; client_id null = modèle)
-- ---------------------------------------------------------------------
create table public.programs (
  id                 uuid primary key default gen_random_uuid(),
  coach_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id          uuid references public.clients(id) on delete cascade,
  name               text not null check (char_length(trim(name)) between 1 and 120),
  goal               text check (goal in ('hypertrophie', 'force', 'perte_de_poids', 'remise_en_forme', 'preparation_physique', 'autre')),
  level              text check (level in ('debutant', 'intermediaire', 'avance')),
  split_type         text check (char_length(split_type) <= 60),
  duration_weeks     smallint check (duration_weeks between 1 and 104),
  sessions_per_week  smallint check (sessions_per_week between 0 and 14),
  description        text check (char_length(description) <= 4000),
  instructions       text check (char_length(instructions) <= 4000),
  is_template        boolean not null default false,
  archived           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index programs_coach_idx on public.programs (coach_id, archived, updated_at desc);
create index programs_client_idx on public.programs (client_id);

-- Séances d'un programme (Séance A, Jour 1, ...)
create table public.program_sessions (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  program_id  uuid not null references public.programs(id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 80),
  notes       text check (char_length(notes) <= 2000),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index program_sessions_program_idx on public.program_sessions (program_id, position);

-- Configuration d'un exercice DANS une séance (propre à ce programme)
create table public.program_exercises (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id      uuid not null references public.program_sessions(id) on delete cascade,
  -- Impossible de supprimer de la bibliothèque un exercice utilisé dans un programme
  exercise_id     uuid not null references public.exercises(id) on delete restrict,
  position        integer not null default 0,
  sets            smallint check (sets between 0 and 50),
  reps            text check (char_length(reps) <= 30),
  load_kg         numeric(6,2) check (load_kg >= 0 and load_kg <= 1000),
  rpe             numeric(3,1) check (rpe between 1 and 10),
  rir             smallint check (rir between 0 and 10),
  rest_seconds    integer check (rest_seconds between 0 and 3600),
  tempo           text check (char_length(tempo) <= 20),
  set_type        text check (set_type in ('echauffement', 'travail', 'degressive', 'rest_pause', 'autre')),
  technical_cues  text check (char_length(technical_cues) <= 2000),
  comments        text check (char_length(comments) <= 2000),
  created_at      timestamptz not null default now()
);
create index program_exercises_session_idx on public.program_exercises (session_id, position);
create index program_exercises_exercise_idx on public.program_exercises (exercise_id);

-- ---------------------------------------------------------------------
-- SÉANCES RÉALISÉES (historique de performances — jamais effacé
-- par la modification ou la suppression d'un programme)
-- ---------------------------------------------------------------------
create table public.workout_logs (
  id                  uuid primary key default gen_random_uuid(),
  coach_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  program_id          uuid references public.programs(id) on delete set null,
  program_session_id  uuid references public.program_sessions(id) on delete set null,
  -- Copie des noms pour que l'historique reste lisible même si le programme change
  program_name        text,
  session_name        text,
  performed_on        date not null default current_date,
  coach_comments      text check (char_length(coach_comments) <= 4000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index workout_logs_client_idx on public.workout_logs (client_id, performed_on desc);

create table public.workout_sets (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_log_id  uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id     uuid references public.exercises(id) on delete set null,
  exercise_name   text not null,
  exercise_order  integer not null default 0,
  set_number      smallint not null default 1 check (set_number between 1 and 100),
  set_type        text check (set_type in ('echauffement', 'travail', 'degressive', 'rest_pause', 'autre')),
  -- Prévu (copié depuis le programme au moment de la saisie)
  planned_reps    text,
  planned_load_kg numeric(6,2),
  planned_rpe     numeric(3,1),
  planned_rir     smallint,
  -- Réalisé
  load_kg         numeric(6,2) check (load_kg >= 0 and load_kg <= 1000),
  reps            smallint check (reps between 0 and 200),
  rpe             numeric(3,1) check (rpe between 1 and 10),
  rir             smallint check (rir between 0 and 10),
  rest_seconds    integer check (rest_seconds between 0 and 3600),
  comment         text check (char_length(comment) <= 1000),
  created_at      timestamptz not null default now()
);
create index workout_sets_log_idx on public.workout_sets (workout_log_id, exercise_order, set_number);
create index workout_sets_exercise_idx on public.workout_sets (exercise_id);

-- ---------------------------------------------------------------------
-- PERTE DE POIDS
-- ---------------------------------------------------------------------
-- Objectif de poids (un par client)
create table public.weight_goals (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id      uuid not null unique references public.clients(id) on delete cascade,
  start_weight   numeric(5,2) check (start_weight between 20 and 400),
  start_date     date,
  target_weight  numeric(5,2) check (target_weight between 20 and 400),
  target_date    date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Objectifs intermédiaires facultatifs
create table public.weight_milestones (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  label        text check (char_length(label) <= 80),
  weight       numeric(5,2) not null check (weight between 20 and 400),
  target_date  date,
  created_at   timestamptz not null default now()
);
create index weight_milestones_client_idx on public.weight_milestones (client_id, weight);

-- Pesées réellement effectuées
create table public.weigh_ins (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  measured_on  date not null default current_date,
  weight_kg    numeric(5,2) not null check (weight_kg between 20 and 400),
  comment      text check (char_length(comment) <= 1000),
  created_at   timestamptz not null default now()
);
create index weigh_ins_client_idx on public.weigh_ins (client_id, measured_on);

-- Mensurations (toutes facultatives, au moins une requise)
create table public.measurements (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  measured_on  date not null default current_date,
  waist_cm     numeric(5,1) check (waist_cm between 20 and 300),
  hips_cm      numeric(5,1) check (hips_cm between 20 and 300),
  chest_cm     numeric(5,1) check (chest_cm between 20 and 300),
  thigh_cm     numeric(5,1) check (thigh_cm between 10 and 200),
  arm_cm       numeric(5,1) check (arm_cm between 10 and 150),
  comment      text check (char_length(comment) <= 1000),
  created_at   timestamptz not null default now(),
  constraint measurements_not_empty check (
    coalesce(waist_cm, hips_cm, chest_cm, thigh_cm, arm_cm) is not null
  )
);
create index measurements_client_idx on public.measurements (client_id, measured_on);

-- Bilans périodiques
create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  review_date     date not null default current_date,
  weight_kg       numeric(5,2) check (weight_kg between 20 and 400),
  difficulties    text check (char_length(difficulties) <= 4000),
  positives       text check (char_length(positives) <= 4000),
  coach_comments  text check (char_length(coach_comments) <= 4000),
  next_goals      text check (char_length(next_goals) <= 4000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index reviews_client_idx on public.reviews (client_id, review_date desc);

-- ---------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------
create trigger clients_updated_at      before update on public.clients      for each row execute function public.set_updated_at();
create trigger exercises_updated_at    before update on public.exercises    for each row execute function public.set_updated_at();
create trigger programs_updated_at     before update on public.programs     for each row execute function public.set_updated_at();
create trigger workout_logs_updated_at before update on public.workout_logs for each row execute function public.set_updated_at();
create trigger weight_goals_updated_at before update on public.weight_goals for each row execute function public.set_updated_at();
create trigger reviews_updated_at      before update on public.reviews      for each row execute function public.set_updated_at();

-- Toute modification d'une séance ou d'un exercice d'un programme
-- met à jour la date de modification du programme.
create or replace function public.touch_program()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if tg_table_name = 'program_sessions' then
    pid := coalesce(new.program_id, old.program_id);
  else
    select program_id into pid from public.program_sessions
      where id = coalesce(new.session_id, old.session_id);
  end if;
  if pid is not null then
    update public.programs set updated_at = now() where id = pid;
  end if;
  return null;
end;
$$;

create trigger program_sessions_touch after insert or update or delete on public.program_sessions
  for each row execute function public.touch_program();
create trigger program_exercises_touch after insert or update or delete on public.program_exercises
  for each row execute function public.touch_program();
