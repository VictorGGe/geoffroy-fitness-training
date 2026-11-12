-- =====================================================================
-- Victor Training — signature en ligne des devis
-- Le client signe depuis un lien personnel (jeton secret) ; le coach signe dans l'application.
-- La page publique passe par le serveur de l'application (clé secrète), jamais directement par la base.
-- =====================================================================

alter table public.quotes
  add column if not exists sign_token uuid not null default gen_random_uuid(),
  add column if not exists client_signature text check (client_signature is null or char_length(client_signature) <= 400000),
  add column if not exists client_signed_name text check (client_signed_name is null or char_length(client_signed_name) <= 120),
  add column if not exists client_signed_at timestamptz,
  add column if not exists client_sign_info jsonb,
  add column if not exists coach_signature text check (coach_signature is null or char_length(coach_signature) <= 400000),
  add column if not exists coach_signed_at timestamptz;
create unique index if not exists quotes_sign_token_idx on public.quotes (sign_token);
grant select, update on table public.quotes to service_role;
notify pgrst, 'reload schema';
