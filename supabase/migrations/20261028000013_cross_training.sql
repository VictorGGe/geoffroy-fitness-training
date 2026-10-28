-- =====================================================================
-- Victor Training — cross training en petit groupe (inscription publique)
-- Le coach crée des créneaux (3 à 6 personnes). Les participants s'inscrivent
-- sans compte via une page publique : toutes leurs opérations passent par le
-- serveur de l'application (clé secrète), jamais directement par la base.
-- =====================================================================

create table if not exists public.ct_slots (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title         text not null default 'Cross training' check (char_length(title) between 1 and 80),
  starts_at     timestamptz not null,
  duration_min  smallint not null default 60 check (duration_min between 15 and 240),
  location      text check (char_length(location) <= 160),
  price         numeric(8,2) not null check (price >= 1 and price <= 1000),
  min_people    smallint not null default 3 check (min_people between 1 and 50),
  max_people    smallint not null default 6 check (max_people between 1 and 50),
  status        text not null default 'ouvert' check (status in ('ouvert', 'annule')),
  notes         text check (char_length(notes) <= 1000),
  series_id     uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ct_slots_min_max check (min_people <= max_people)
);
create index if not exists ct_slots_coach_time_idx on public.ct_slots (coach_id, starts_at);

create table if not exists public.ct_registrations (
  id                 uuid primary key default gen_random_uuid(),
  slot_id            uuid not null references public.ct_slots(id) on delete cascade,
  coach_id           uuid not null references auth.users(id) on delete cascade,
  first_name         text not null check (char_length(first_name) between 1 and 60),
  last_name          text not null check (char_length(last_name) between 1 and 60),
  email              text not null check (char_length(email) between 3 and 160),
  phone              text not null check (char_length(phone) between 6 and 30),
  -- Lien personnel (secret) envoyé au participant pour suivre son inscription et payer
  token              uuid not null unique default gen_random_uuid(),
  status             text not null default 'inscrit' check (status in ('inscrit', 'paye', 'annule')),
  consents           jsonb not null default '{}'::jsonb,
  consent_version    text,
  stripe_session_id  text,
  amount_paid        numeric(8,2),
  paid_at            timestamptz,
  paid_by            text check (paid_by in ('carte', 'manuel')),
  pay_notified_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists ct_registrations_slot_idx on public.ct_registrations (slot_id);
create unique index if not exists ct_registrations_one_per_email
  on public.ct_registrations (slot_id, lower(email)) where status <> 'annule';

drop trigger if exists ct_slots_updated_at on public.ct_slots;
create trigger ct_slots_updated_at before update on public.ct_slots
  for each row execute function public.set_updated_at();
drop trigger if exists ct_registrations_updated_at on public.ct_registrations;
create trigger ct_registrations_updated_at before update on public.ct_registrations
  for each row execute function public.set_updated_at();

-- Une inscription appartient toujours au coach du créneau
create or replace function public.ct_registrations_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coach_id into new.coach_id from public.ct_slots where id = new.slot_id;
  if new.coach_id is null then
    raise exception 'Créneau introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.ct_registrations_owner() from public, anon, authenticated;
drop trigger if exists ct_registrations_owner on public.ct_registrations;
create trigger ct_registrations_owner before insert or update of slot_id on public.ct_registrations
  for each row execute function public.ct_registrations_owner();

-- Accès coach uniquement (les participants passent par le serveur de l'application)
alter table public.ct_slots enable row level security;
alter table public.ct_slots force row level security;
alter table public.ct_registrations enable row level security;
alter table public.ct_registrations force row level security;
revoke all on table public.ct_slots, public.ct_registrations from anon;
grant select, insert, update, delete on table public.ct_slots, public.ct_registrations to authenticated;
grant select, insert, update, delete on table public.ct_slots, public.ct_registrations to service_role;
grant select, insert on table public.invoices to service_role;

do $$
declare
  t text;
begin
  foreach t in array array['ct_slots', 'ct_registrations'] loop
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

-- Inscription atomique : verrouille le créneau pour ne jamais dépasser le maximum.
-- Appelable uniquement par le serveur de l'application (clé secrète).
create or replace function public.ct_register(
  p_slot uuid,
  p_first text,
  p_last text,
  p_email text,
  p_phone text,
  p_consents jsonb,
  p_version text
)
returns table (registration_id uuid, token uuid, active_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.ct_slots%rowtype;
  n integer;
  r public.ct_registrations%rowtype;
begin
  select * into s from public.ct_slots where id = p_slot for update;
  if not found or s.status <> 'ouvert' then
    raise exception 'CT_CLOSED' using errcode = 'P0001';
  end if;
  if s.starts_at <= now() then
    raise exception 'CT_PAST' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.ct_registrations x
    where x.slot_id = p_slot and x.status <> 'annule' and lower(x.email) = lower(trim(p_email))
  ) then
    raise exception 'CT_DUPLICATE' using errcode = 'P0001';
  end if;
  select count(*) into n from public.ct_registrations x where x.slot_id = p_slot and x.status <> 'annule';
  if n >= s.max_people then
    raise exception 'CT_FULL' using errcode = 'P0001';
  end if;

  insert into public.ct_registrations (slot_id, coach_id, first_name, last_name, email, phone, consents, consent_version)
  values (p_slot, s.coach_id, trim(p_first), trim(p_last), lower(trim(p_email)), trim(p_phone), p_consents, p_version)
  returning * into r;

  registration_id := r.id;
  token := r.token;
  active_count := n + 1;
  return next;
end;
$$;
revoke execute on function public.ct_register(uuid, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.ct_register(uuid, text, text, text, text, jsonb, text) to service_role;

notify pgrst, 'reload schema';
