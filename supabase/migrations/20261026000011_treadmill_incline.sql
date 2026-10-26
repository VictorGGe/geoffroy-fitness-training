-- =====================================================================
-- Victor Training — inclinaison du tapis de course (en %)
-- =====================================================================

alter table public.program_exercises
  add column if not exists incline_pct numeric(4,1) check (incline_pct between 0 and 40);

alter table public.workout_sets
  add column if not exists incline_pct         numeric(4,1) check (incline_pct between 0 and 40),
  add column if not exists planned_incline_pct numeric(4,1);

alter table public.runs
  add column if not exists incline_pct numeric(4,1) check (incline_pct between 0 and 40);

notify pgrst, 'reload schema';
