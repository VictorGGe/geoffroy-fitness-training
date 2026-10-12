-- =====================================================================
-- Geoffroy Fitness Training — sécurité (Row Level Security)
-- Chaque ligne n'est visible et modifiable que par le coach
-- authentifié qui en est propriétaire (coach_id = auth.uid()).
-- Le rôle "anon" (visiteur non connecté) n'a aucun accès.
-- =====================================================================

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
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);

    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (coach_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (coach_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (coach_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Cohérence des propriétaires : une ligne enfant ne peut pas pointer
-- vers une ligne parente appartenant à un autre compte.
-- ---------------------------------------------------------------------
create or replace function public.assert_same_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_owner uuid;
begin
  if tg_table_name = 'program_sessions' then
    select coach_id into parent_owner from public.programs where id = new.program_id;
  elsif tg_table_name = 'program_exercises' then
    select coach_id into parent_owner from public.program_sessions where id = new.session_id;
    if parent_owner = new.coach_id then
      select coach_id into parent_owner from public.exercises where id = new.exercise_id;
    end if;
  elsif tg_table_name = 'workout_sets' then
    select coach_id into parent_owner from public.workout_logs where id = new.workout_log_id;
  elsif tg_table_name = 'programs' then
    if new.client_id is null then return new; end if;
    select coach_id into parent_owner from public.clients where id = new.client_id;
  else
    select coach_id into parent_owner from public.clients where id = new.client_id;
  end if;

  if parent_owner is distinct from new.coach_id then
    raise exception 'Accès refusé : ressource parente introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger programs_owner          before insert or update on public.programs          for each row execute function public.assert_same_owner();
create trigger program_sessions_owner  before insert or update on public.program_sessions  for each row execute function public.assert_same_owner();
create trigger program_exercises_owner before insert or update on public.program_exercises for each row execute function public.assert_same_owner();
create trigger workout_logs_owner      before insert or update on public.workout_logs      for each row execute function public.assert_same_owner();
create trigger workout_sets_owner      before insert or update on public.workout_sets      for each row execute function public.assert_same_owner();
create trigger weight_goals_owner      before insert or update on public.weight_goals      for each row execute function public.assert_same_owner();
create trigger weight_milestones_owner before insert or update on public.weight_milestones for each row execute function public.assert_same_owner();
create trigger weigh_ins_owner         before insert or update on public.weigh_ins         for each row execute function public.assert_same_owner();
create trigger measurements_owner      before insert or update on public.measurements      for each row execute function public.assert_same_owner();
create trigger reviews_owner           before insert or update on public.reviews           for each row execute function public.assert_same_owner();

-- Les fonctions utilitaires ne sont pas appelables directement via l'API
revoke execute on function public.assert_same_owner() from public, anon, authenticated;
revoke execute on function public.touch_program() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
