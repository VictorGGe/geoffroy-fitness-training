-- =====================================================================
-- Geoffroy Fitness Training — espace client
-- Chaque client peut recevoir un compte (créé par le coach) lui donnant
-- accès UNIQUEMENT à ses programmes et à ses séances.
-- Le coach conserve un accès complet à toutes les données.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Comptes clients (créés exclusivement côté serveur par le coach)
-- ---------------------------------------------------------------------
create table if not exists public.client_accounts (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  client_id   uuid not null unique references public.clients(id) on delete cascade,
  coach_id    uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now()
);

alter table public.client_accounts enable row level security;
alter table public.client_accounts force row level security;
revoke all on table public.client_accounts from anon;
revoke insert, update, delete on table public.client_accounts from authenticated;
grant select on table public.client_accounts to authenticated;

drop policy if exists client_accounts_coach_select on public.client_accounts;
create policy client_accounts_coach_select on public.client_accounts
  for select to authenticated using (coach_id = (select auth.uid()));
drop policy if exists client_accounts_self_select on public.client_accounts;
create policy client_accounts_self_select on public.client_accounts
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Fonctions de rôle (security definer : lisent client_accounts sans RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_client_user()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.client_accounts where user_id = auth.uid())
      or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'client';
$$;

create or replace function public.my_client_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select client_id from public.client_accounts where user_id = auth.uid();
$$;

-- Propriétaire des données : le coach (pour un client connecté, c'est son coach)
create or replace function public.current_coach_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select coalesce((select coach_id from public.client_accounts where user_id = auth.uid()), auth.uid());
$$;

create or replace function public.client_owns_program(pid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.programs p
    where p.id = pid and p.client_id is not null and p.client_id = public.my_client_id()
  );
$$;

create or replace function public.client_owns_session(sid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.program_sessions s
    join public.programs p on p.id = s.program_id
    where s.id = sid and p.client_id is not null and p.client_id = public.my_client_id()
  );
$$;

create or replace function public.client_owns_log(lid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workout_logs w
    where w.id = lid and w.client_id = public.my_client_id()
  );
$$;

grant execute on function public.is_client_user(), public.my_client_id(), public.current_coach_id(),
  public.client_owns_program(uuid), public.client_owns_session(uuid), public.client_owns_log(uuid)
  to authenticated;
revoke execute on function public.is_client_user(), public.my_client_id(), public.current_coach_id(),
  public.client_owns_program(uuid), public.client_owns_session(uuid), public.client_owns_log(uuid)
  from anon, public;

-- ---------------------------------------------------------------------
-- coach_id par défaut = le coach, y compris quand c'est le client qui écrit
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'clients', 'exercises', 'programs', 'program_sessions', 'program_exercises',
    'workout_logs', 'workout_sets', 'weight_goals', 'weight_milestones',
    'weigh_ins', 'measurements', 'reviews'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I alter column coach_id set default public.current_coach_id()', t);

    -- Règles du coach : inchangées, mais refusées à un compte client
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (coach_id = (select auth.uid()) and not public.is_client_user())',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (coach_id = (select auth.uid()) and not public.is_client_user())',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (coach_id = (select auth.uid()) and not public.is_client_user()) with check (coach_id = (select auth.uid()) and not public.is_client_user())',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (coach_id = (select auth.uid()) and not public.is_client_user())',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Règles du client connecté
-- ---------------------------------------------------------------------
-- Sa propre fiche : PAS d'accès direct à la table clients (elle contient les notes
-- privées du coach). Le client ne lit que son prénom et son nom via cette fonction.
drop policy if exists clients_client_select on public.clients;
create or replace function public.my_client_profile()
returns table (id uuid, first_name text, last_name text)
language sql stable security definer
set search_path = public
as $$
  select c.id, c.first_name, c.last_name from public.clients c where c.id = public.my_client_id();
$$;
grant execute on function public.my_client_profile() to authenticated;
revoke execute on function public.my_client_profile() from anon, public;

-- Ses programmes (lecture seule pour les informations générales)
drop policy if exists programs_client_select on public.programs;
create policy programs_client_select on public.programs
  for select to authenticated using (client_id is not null and client_id = public.my_client_id());

-- Séances de ses programmes (lecture + modification)
drop policy if exists program_sessions_client_all on public.program_sessions;
create policy program_sessions_client_all on public.program_sessions
  for all to authenticated
  using (public.client_owns_program(program_id))
  with check (public.client_owns_program(program_id) and coach_id = public.current_coach_id());

-- Exercices de ses programmes (lecture + modification)
drop policy if exists program_exercises_client_all on public.program_exercises;
create policy program_exercises_client_all on public.program_exercises
  for all to authenticated
  using (public.client_owns_session(session_id))
  with check (public.client_owns_session(session_id) and coach_id = public.current_coach_id());

-- Bibliothèque d'exercices du coach (lecture seule)
drop policy if exists exercises_client_select on public.exercises;
create policy exercises_client_select on public.exercises
  for select to authenticated using (public.is_client_user() and coach_id = public.current_coach_id());

-- Ses séances réalisées (lecture + saisie + modification)
drop policy if exists workout_logs_client_all on public.workout_logs;
create policy workout_logs_client_all on public.workout_logs
  for all to authenticated
  using (client_id = public.my_client_id())
  with check (client_id = public.my_client_id() and coach_id = public.current_coach_id());

drop policy if exists workout_sets_client_all on public.workout_sets;
create policy workout_sets_client_all on public.workout_sets
  for all to authenticated
  using (public.client_owns_log(workout_log_id))
  with check (public.client_owns_log(workout_log_id) and coach_id = public.current_coach_id());
