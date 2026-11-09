-- =====================================================================
-- Victor Training — photos des machines dans les programmes
-- Jusqu'à 6 photos par exercice d'un programme, prises avec le téléphone du coach.
-- Les fichiers sont rangés dans l'espace de stockage « exercise-videos »
-- (dossier du coach / machines), en JPEG, lisibles par le client via le programme.
-- =====================================================================

alter table public.program_exercises
  add column if not exists image_urls text[] not null default '{}';

alter table public.program_exercises
  drop constraint if exists program_exercises_image_urls_max;
alter table public.program_exercises
  add constraint program_exercises_image_urls_max check (cardinality(image_urls) <= 6);

notify pgrst, 'reload schema';
