-- =====================================================================
-- Victor Training — agenda du coach (séances, bilans, suivis…)
-- Le client voit uniquement ses propres rendez-vous, sans les notes du coach.
-- =====================================================================

create table if not exists public.appointments (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null default public.current_coach_id() references auth.users(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete cascade,
  guest_name    text check (char_length(guest_name) <= 120),
  kind          text not null default 'seance' check (kind in ('seance', 'bilan', 'suivi', 'autre')),
  title         text check (char_length(title) <= 120),
  starts_at     timestamptz not null,
  duration_min  smallint not null default 60 check (duration_min between 5 and 720),
  location      text check (char_length(location) <= 160),
  notes         text check (char_length(notes) <= 4000),
  status        text not null default 'prevu' check (status in ('prevu', 'fait', 'annule', 'absent')),
  series_id     uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint appointments_who check (client_id is not null or guest_name is not null or title is not null)
);
create index if not exists appointments_coach_time_idx on public.appointments (coach_id, starts_at);
create index if not exists appointments_client_idx on public.appointments (client_id, starts_at);
create index if not exists appointments_series_idx on public.appointments (series_id);

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- Le client rattaché doit appartenir au même coach
create or replace function public.appointments_check_owner()
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
revoke execute on function public.appointments_check_owner() from public, anon, authenticated;
drop trigger if exists appointments_owner on public.appointments;
create trigger appointments_owner before insert or update on public.appointments
  for each row execute function public.appointments_check_owner();

alter table public.appointments enable row level security;
alter table public.appointments force row level security;
revoke all on table public.appointments from anon;
grant select, insert, update, delete on table public.appointments to authenticated;

drop policy if exists appointments_select_own on public.appointments;
drop policy if exists appointments_insert_own on public.appointments;
drop policy if exists appointments_update_own on public.appointments;
drop policy if exists appointments_delete_own on public.appointments;
create policy appointments_select_own on public.appointments for select to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user());
create policy appointments_insert_own on public.appointments for insert to authenticated
  with check (coach_id = (select auth.uid()) and not public.is_client_user());
create policy appointments_update_own on public.appointments for update to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user())
  with check (coach_id = (select auth.uid()) and not public.is_client_user());
create policy appointments_delete_own on public.appointments for delete to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user());

-- Côté client : ses rendez-vous à venir (sans les notes privées du coach)
create or replace function public.my_appointments()
returns table (id uuid, kind text, title text, starts_at timestamptz, duration_min smallint, location text, status text)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.kind, a.title, a.starts_at, a.duration_min, a.location, a.status
  from public.appointments a
  where a.client_id = public.my_client_id()
    and a.client_id is not null
    and a.starts_at >= now() - interval '1 day'
    and a.status <> 'annule'
  order by a.starts_at
  limit 20;
$$;
grant execute on function public.my_appointments() to authenticated;
revoke execute on function public.my_appointments() from anon, public;

notify pgrst, 'reload schema';
