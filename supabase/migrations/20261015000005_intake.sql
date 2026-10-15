-- =====================================================================
-- Victor Training — bilan de départ (questionnaire initial du client)
-- Réservé au coach : contient des informations de santé.
-- =====================================================================

create table if not exists public.client_intakes (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default public.current_coach_id() references auth.users(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  assessed_on  date not null default current_date,
  answers      jsonb not null default '{}'::jsonb check (pg_column_size(answers) < 60000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists client_intakes_client_idx on public.client_intakes (client_id, assessed_on desc);

drop trigger if exists client_intakes_updated_at on public.client_intakes;
create trigger client_intakes_updated_at before update on public.client_intakes
  for each row execute function public.set_updated_at();
drop trigger if exists client_intakes_owner on public.client_intakes;
create trigger client_intakes_owner before insert or update on public.client_intakes
  for each row execute function public.assert_same_owner();

alter table public.client_intakes enable row level security;
alter table public.client_intakes force row level security;
revoke all on table public.client_intakes from anon;
grant select, insert, update, delete on table public.client_intakes to authenticated;

drop policy if exists client_intakes_select_own on public.client_intakes;
drop policy if exists client_intakes_insert_own on public.client_intakes;
drop policy if exists client_intakes_update_own on public.client_intakes;
drop policy if exists client_intakes_delete_own on public.client_intakes;
create policy client_intakes_select_own on public.client_intakes for select to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user());
create policy client_intakes_insert_own on public.client_intakes for insert to authenticated
  with check (coach_id = (select auth.uid()) and not public.is_client_user());
create policy client_intakes_update_own on public.client_intakes for update to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user())
  with check (coach_id = (select auth.uid()) and not public.is_client_user());
create policy client_intakes_delete_own on public.client_intakes for delete to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user());

notify pgrst, 'reload schema';
