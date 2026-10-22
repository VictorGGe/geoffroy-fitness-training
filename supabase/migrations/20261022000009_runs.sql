-- =====================================================================
-- Victor Training — course à pied (chrono, GPS, allure, calories)
-- Chaque course est aussi enregistrée comme séance (workout_logs) pour
-- apparaître dans l'historique et la progression ; cette table garde
-- les détails : tracé GPS, temps au kilomètre, calories.
-- =====================================================================

create table if not exists public.runs (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null default public.current_coach_id() references auth.users(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  workout_log_id  uuid references public.workout_logs(id) on delete cascade,
  mode            text not null default 'gps' check (mode in ('gps', 'tapis')),
  activity        text not null default 'course' check (activity in ('course', 'marche')),
  started_at      timestamptz not null,
  duration_s      integer not null check (duration_s between 1 and 86400),
  distance_m      integer not null default 0 check (distance_m between 0 and 500000),
  calories        integer check (calories between 0 and 20000),
  weight_kg       numeric(5,2) check (weight_kg between 20 and 400),
  splits          jsonb not null default '[]'::jsonb check (pg_column_size(splits) < 20000),
  route           jsonb not null default '[]'::jsonb check (pg_column_size(route) < 400000),
  feeling         smallint check (feeling between 1 and 10),
  note            text check (char_length(note) <= 2000),
  created_at      timestamptz not null default now()
);
create index if not exists runs_client_idx on public.runs (client_id, started_at desc);

drop trigger if exists runs_owner on public.runs;
create trigger runs_owner before insert or update on public.runs
  for each row execute function public.assert_same_owner();

alter table public.runs enable row level security;
alter table public.runs force row level security;
revoke all on table public.runs from anon;
grant select, insert, update, delete on table public.runs to authenticated;

drop policy if exists runs_select_own on public.runs;
drop policy if exists runs_insert_own on public.runs;
drop policy if exists runs_update_own on public.runs;
drop policy if exists runs_delete_own on public.runs;
create policy runs_select_own on public.runs for select to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user());
create policy runs_insert_own on public.runs for insert to authenticated
  with check (coach_id = (select auth.uid()) and not public.is_client_user());
create policy runs_update_own on public.runs for update to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user())
  with check (coach_id = (select auth.uid()) and not public.is_client_user());
create policy runs_delete_own on public.runs for delete to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user());

-- Le client gère ses propres courses
drop policy if exists runs_client_all on public.runs;
create policy runs_client_all on public.runs for all to authenticated
  using (client_id = public.my_client_id())
  with check (client_id = public.my_client_id() and coach_id = public.current_coach_id());

-- Dernier poids connu du client connecté (pour estimer les calories),
-- sans lui ouvrir l'accès aux tables de suivi du coach.
create or replace function public.my_latest_weight()
returns numeric
language sql stable security definer
set search_path = public
as $$
  select w.weight_kg from public.weigh_ins w
  where w.client_id = public.my_client_id()
  order by w.measured_on desc, w.created_at desc
  limit 1;
$$;
grant execute on function public.my_latest_weight() to authenticated;
revoke execute on function public.my_latest_weight() from anon, public;

notify pgrst, 'reload schema';
