-- =====================================================================
-- Geoffroy Fitness Training — exercices cardio
-- Durée, distance, intensité et fréquence cardiaque (cible et réelle).
-- Tous les champs sont facultatifs.
-- =====================================================================

-- Objectifs dans le programme
alter table public.program_exercises
  add column if not exists duration_seconds integer check (duration_seconds between 0 and 86400),
  add column if not exists distance_km      numeric(6,2) check (distance_km >= 0 and distance_km <= 1000),
  add column if not exists intensity        text check (char_length(intensity) <= 60),
  add column if not exists hr_min           smallint check (hr_min between 30 and 250),
  add column if not exists hr_max           smallint check (hr_max between 30 and 250);

-- Réalisé (et rappel du prévu) dans les séances
alter table public.workout_sets
  add column if not exists duration_seconds          integer check (duration_seconds between 0 and 86400),
  add column if not exists distance_km               numeric(6,2) check (distance_km >= 0 and distance_km <= 1000),
  add column if not exists intensity                 text check (char_length(intensity) <= 60),
  add column if not exists hr_avg                    smallint check (hr_avg between 30 and 250),
  add column if not exists hr_max                    smallint check (hr_max between 30 and 250),
  add column if not exists planned_duration_seconds  integer,
  add column if not exists planned_distance_km       numeric(6,2),
  add column if not exists planned_intensity         text,
  add column if not exists planned_hr_min            smallint,
  add column if not exists planned_hr_max            smallint;

-- PostgREST : recharger le schéma pour exposer les nouvelles colonnes
notify pgrst, 'reload schema';
