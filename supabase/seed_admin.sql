-- (Facultatif) Vérifications après création du compte administrateur.
-- À exécuter dans Supabase > SQL Editor.

-- 1. Le compte coach existe-t-il ?
select id, email, created_at, last_sign_in_at from auth.users order by created_at;

-- 2. Toutes les tables ont-elles la Row Level Security activée ?
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
