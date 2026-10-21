-- =====================================================================
-- Victor Training — vidéos d'exercices envoyées depuis le téléphone
-- Espace de stockage « exercise-videos » :
--   * lecture publique par lien (pour que les clients et les PDF puissent lire la vidéo) ;
--   * envoi / suppression réservés au coach, uniquement dans son propre dossier.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-videos',
  'exercise-videos',
  true,
  52428800, -- 50 Mo par fichier (limite du plan gratuit)
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists exercise_videos_coach_select on storage.objects;
drop policy if exists exercise_videos_coach_insert on storage.objects;
drop policy if exists exercise_videos_coach_update on storage.objects;
drop policy if exists exercise_videos_coach_delete on storage.objects;

create policy exercise_videos_coach_select on storage.objects for select to authenticated
  using (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.is_client_user());

create policy exercise_videos_coach_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.is_client_user());

create policy exercise_videos_coach_update on storage.objects for update to authenticated
  using (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.is_client_user())
  with check (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.is_client_user());

create policy exercise_videos_coach_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.is_client_user());
