-- =====================================================================
-- Victor Training — finances du coach (factures, charges, loyer)
-- Strictement réservé au coach : un client ne voit jamais ces tables.
-- =====================================================================

-- Factures émises
create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  client_name  text check (char_length(client_name) <= 120),
  label        text check (char_length(label) <= 160),
  number       text check (char_length(number) <= 40),
  amount       numeric(10,2) not null check (amount > 0 and amount <= 100000),
  issued_on    date not null default current_date,
  paid         boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists invoices_coach_date_idx on public.invoices (coach_id, issued_on);

-- Dépenses du mois (loyer de la salle, matériel…)
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  category     text not null default 'autre' check (category in ('loyer', 'autre')),
  label        text check (char_length(label) <= 160),
  amount       numeric(10,2) not null check (amount > 0 and amount <= 100000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists expenses_coach_month_idx on public.expenses (coach_id, month);

-- Réglages : taux de charges (19 % par défaut) et objectif de revenu net mensuel
create table if not exists public.finance_settings (
  coach_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  charge_rate  numeric(5,2) not null default 19 check (charge_rate between 0 and 80),
  net_goal     numeric(10,2) not null default 2000 check (net_goal between 0 and 1000000),
  updated_at   timestamptz not null default now()
);

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
drop trigger if exists finance_settings_updated_at on public.finance_settings;
create trigger finance_settings_updated_at before update on public.finance_settings
  for each row execute function public.set_updated_at();

-- Le client rattaché à une facture doit appartenir au même coach
create or replace function public.invoices_check_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null and not exists (
    select 1 from public.clients c where c.id = new.client_id and c.coach_id = new.coach_id
  ) then
    raise exception 'Client invalide pour ce coach' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.invoices_check_owner() from public, anon, authenticated;
drop trigger if exists invoices_owner on public.invoices;
create trigger invoices_owner before insert or update on public.invoices
  for each row execute function public.invoices_check_owner();

alter table public.invoices enable row level security;
alter table public.invoices force row level security;
alter table public.expenses enable row level security;
alter table public.expenses force row level security;
alter table public.finance_settings enable row level security;
alter table public.finance_settings force row level security;
revoke all on table public.invoices, public.expenses, public.finance_settings from anon;
grant select, insert, update, delete on table public.invoices, public.expenses, public.finance_settings to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['invoices', 'expenses', 'finance_settings'] loop
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

notify pgrst, 'reload schema';
