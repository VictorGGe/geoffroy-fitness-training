-- =====================================================================
-- Victor Training — suivi alimentaire et macros journaliers
--   nutrition_targets : objectifs fixés par le coach (1 ligne par client)
--   food_entries      : journal alimentaire (saisi par le client ou le coach)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Objectifs nutritionnels
-- ---------------------------------------------------------------------
create table if not exists public.nutrition_targets (
  client_id    uuid primary key references public.clients(id) on delete cascade,
  coach_id     uuid not null default public.current_coach_id() references auth.users(id) on delete cascade,
  kcal         integer not null check (kcal between 500 and 10000),
  protein_g    numeric(6,1) not null check (protein_g between 0 and 1000),
  carbs_g      numeric(6,1) not null check (carbs_g between 0 and 2000),
  fat_g        numeric(6,1) not null check (fat_g between 0 and 1000),
  inputs       jsonb not null default '{}'::jsonb check (pg_column_size(inputs) < 4000),
  note         text check (char_length(note) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists nutrition_targets_updated_at on public.nutrition_targets;
create trigger nutrition_targets_updated_at before update on public.nutrition_targets
  for each row execute function public.set_updated_at();
drop trigger if exists nutrition_targets_owner on public.nutrition_targets;
create trigger nutrition_targets_owner before insert or update on public.nutrition_targets
  for each row execute function public.assert_same_owner();

-- ---------------------------------------------------------------------
-- Journal alimentaire
--   unit = 'g' ou 'ml' : valeurs pour 100 g / 100 ml, quantity = grammes / ml
--   unit = 'portion'   : valeurs pour 1 portion,     quantity = nombre de portions
-- ---------------------------------------------------------------------
create table if not exists public.food_entries (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default public.current_coach_id() references auth.users(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  eaten_on    date not null default current_date,
  meal        text not null check (meal in ('petit_dejeuner', 'dejeuner', 'collation', 'diner')),
  name        text not null check (char_length(trim(name)) between 1 and 160),
  brand       text check (char_length(brand) <= 120),
  barcode     text check (barcode ~ '^[0-9]{6,14}$'),
  source      text not null default 'manuel' check (source in ('base', 'off', 'manuel')),
  unit        text not null default 'g' check (unit in ('g', 'ml', 'portion')),
  quantity    numeric(7,2) not null check (quantity > 0 and quantity <= 5000),
  kcal        numeric(7,1) not null check (kcal between 0 and 5000),
  protein_g   numeric(6,1) not null default 0 check (protein_g between 0 and 1000),
  carbs_g     numeric(6,1) not null default 0 check (carbs_g between 0 and 1000),
  fat_g       numeric(6,1) not null default 0 check (fat_g between 0 and 1000),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists food_entries_client_day_idx on public.food_entries (client_id, eaten_on);

drop trigger if exists food_entries_owner on public.food_entries;
create trigger food_entries_owner before insert or update on public.food_entries
  for each row execute function public.assert_same_owner();

-- ---------------------------------------------------------------------
-- Sécurité
-- ---------------------------------------------------------------------
alter table public.nutrition_targets enable row level security;
alter table public.nutrition_targets force row level security;
alter table public.food_entries enable row level security;
alter table public.food_entries force row level security;
revoke all on table public.nutrition_targets, public.food_entries from anon;
grant select, insert, update, delete on table public.nutrition_targets, public.food_entries to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['nutrition_targets', 'food_entries'] loop
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

-- Le client lit ses objectifs (sans pouvoir les modifier)
drop policy if exists nutrition_targets_client_select on public.nutrition_targets;
create policy nutrition_targets_client_select on public.nutrition_targets
  for select to authenticated using (client_id = public.my_client_id());

-- Le client gère son propre journal alimentaire
drop policy if exists food_entries_client_all on public.food_entries;
create policy food_entries_client_all on public.food_entries
  for all to authenticated
  using (client_id = public.my_client_id())
  with check (client_id = public.my_client_id() and coach_id = public.current_coach_id());

notify pgrst, 'reload schema';
