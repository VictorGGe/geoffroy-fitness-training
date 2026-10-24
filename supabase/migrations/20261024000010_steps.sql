-- =====================================================================
-- Victor Training — podomètre : pas quotidiens et objectif de pas
-- =====================================================================

create table if not exists public.daily_steps (
  client_id   uuid not null references public.clients(id) on delete cascade,
  day         date not null,
  coach_id    uuid not null default public.current_coach_id() references auth.users(id) on delete cascade,
  steps       integer not null check (steps between 0 and 150000),
  source      text not null default 'manuel' check (source in ('manuel', 'capteur')),
  updated_at  timestamptz not null default now(),
  primary key (client_id, day)
);

create table if not exists public.step_goals (
  client_id   uuid primary key references public.clients(id) on delete cascade,
  coach_id    uuid not null default public.current_coach_id() references auth.users(id) on delete cascade,
  daily_goal  integer not null check (daily_goal between 1000 and 50000),
  updated_at  timestamptz not null default now()
);

drop trigger if exists daily_steps_updated_at on public.daily_steps;
create trigger daily_steps_updated_at before update on public.daily_steps
  for each row execute function public.set_updated_at();
drop trigger if exists step_goals_updated_at on public.step_goals;
create trigger step_goals_updated_at before update on public.step_goals
  for each row execute function public.set_updated_at();
drop trigger if exists daily_steps_owner on public.daily_steps;
create trigger daily_steps_owner before insert or update on public.daily_steps
  for each row execute function public.assert_same_owner();
drop trigger if exists step_goals_owner on public.step_goals;
create trigger step_goals_owner before insert or update on public.step_goals
  for each row execute function public.assert_same_owner();

alter table public.daily_steps enable row level security;
alter table public.daily_steps force row level security;
alter table public.step_goals enable row level security;
alter table public.step_goals force row level security;
revoke all on table public.daily_steps, public.step_goals from anon;
grant select, insert, update, delete on table public.daily_steps, public.step_goals to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['daily_steps', 'step_goals'] loop
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

-- Le client gère ses propres pas
drop policy if exists daily_steps_client_all on public.daily_steps;
create policy daily_steps_client_all on public.daily_steps for all to authenticated
  using (client_id = public.my_client_id())
  with check (client_id = public.my_client_id() and coach_id = public.current_coach_id());

-- Le client lit son objectif (fixé par le coach)
drop policy if exists step_goals_client_select on public.step_goals;
create policy step_goals_client_select on public.step_goals for select to authenticated
  using (client_id = public.my_client_id());

notify pgrst, 'reload schema';
