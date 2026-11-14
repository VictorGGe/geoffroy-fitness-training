-- Victor Training — détails du devis remplis par le coach (lieu, début, paiement, acompte, notes, pré-remplissages)
alter table public.quotes add column if not exists details jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
