-- =====================================================================
-- Victor Training — devis par client (PDF : devis + conditions générales)
-- Réservé au coach.
-- =====================================================================

create table if not exists public.quotes (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  number         text not null check (char_length(number) between 1 and 40),
  issued_on      date not null default current_date,
  valid_until    date not null,
  intro          text check (char_length(intro) <= 2000),
  client_email   text check (char_length(client_email) <= 160),
  client_phone   text check (char_length(client_phone) <= 40),
  client_address text check (char_length(client_address) <= 300),
  items          jsonb not null default '[]'::jsonb,
  conditions     jsonb not null default '[]'::jsonb,
  total          numeric(10,2) not null default 0 check (total >= 0 and total <= 1000000),
  status         text not null default 'brouillon' check (status in ('brouillon', 'envoye', 'accepte', 'refuse')),
  invoice_id     uuid references public.invoices(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (coach_id, number)
);
create index if not exists quotes_client_idx on public.quotes (client_id, issued_on desc);

drop trigger if exists quotes_updated_at on public.quotes;
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

-- Le client du devis doit appartenir au coach
create or replace function public.quotes_check_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.clients c where c.id = new.client_id and c.coach_id = new.coach_id) then
    raise exception 'Client invalide pour ce coach' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.quotes_check_owner() from public, anon, authenticated;
drop trigger if exists quotes_same_owner on public.quotes;
create trigger quotes_same_owner before insert or update of client_id, coach_id on public.quotes
  for each row execute function public.quotes_check_owner();

alter table public.quotes enable row level security;
alter table public.quotes force row level security;
revoke all on table public.quotes from anon;
grant select, insert, update, delete on table public.quotes to authenticated;

drop policy if exists quotes_select_own on public.quotes;
drop policy if exists quotes_insert_own on public.quotes;
drop policy if exists quotes_update_own on public.quotes;
drop policy if exists quotes_delete_own on public.quotes;
create policy quotes_select_own on public.quotes for select to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user());
create policy quotes_insert_own on public.quotes for insert to authenticated
  with check (coach_id = (select auth.uid()) and not public.is_client_user());
create policy quotes_update_own on public.quotes for update to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user())
  with check (coach_id = (select auth.uid()) and not public.is_client_user());
create policy quotes_delete_own on public.quotes for delete to authenticated
  using (coach_id = (select auth.uid()) and not public.is_client_user());

notify pgrst, 'reload schema';
