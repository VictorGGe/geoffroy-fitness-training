-- =====================================================================
-- Victor Training — explication audio des exercices
-- Une voix enregistrée par le coach, lue en même temps que la vidéo (son de la vidéo coupé par défaut).
-- Fichiers rangés dans l'espace « exercise-videos » (dossier du coach / audio).
-- =====================================================================

alter table public.exercises
  add column if not exists audio_url text check (audio_url is null or (char_length(audio_url) <= 1000 and audio_url ~* '^https?://'));

update storage.buckets
   set allowed_mime_types = array[
     'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp', 'image/jpeg',
     'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-m4a'
   ]
 where id = 'exercise-videos';

notify pgrst, 'reload schema';
