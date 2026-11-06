-- =============================================================================
-- 07 — Une séance ne se rattache qu'à SES parcours ; règles d'accès allégées
-- =============================================================================
--
-- Deux changements, indépendants du code de l'app (aucun déploiement à
-- coordonner : à lancer quand tu veux).
--
-- 1. sessions.goal_id pouvait pointer vers le parcours d'un AUTRE compte :
--    la clé étrangère vérifiait seulement que le parcours existe, pas à
--    qui il appartient. Rien ne fuyait (la RLS cache le titre du parcours
--    d'autrui, y compris à travers les vues), mais la base acceptait une
--    donnée fausse, et la suppression de ce parcours par son propriétaire
--    détachait la séance d'un autre. La clé devient (goal_id, user_id) ->
--    goals(id, user_id) : même parcours ET même compte.
--    « on delete set null (goal_id) » : supprimer un parcours détache ses
--    séances, comme avant, sans toucher à user_id (Postgres 15 et plus).
--
-- 2. Les cinq règles RLS appelaient auth.uid() pour CHAQUE ligne lue.
--    Écrit (select auth.uid()), Postgres le calcule une fois par requête
--    (recommandation Supabase, « auth_rls_initplan »). Même règle, même
--    résultat : propriétaire seulement. « to authenticated » en plus : un
--    visiteur non connecté était déjà refusé (auth.uid() vaut null), la
--    règle ne s'évalue plus du tout pour lui.
--
-- Trois temps :
--   ÉTAPE 0  lecture seule : l'état actuel. À regarder AVANT la suite.
--   ÉTAPE 1  contrôle : s'arrête si une séance pointe déjà vers le
--            parcours d'un autre compte, ou si Postgres est trop ancien.
--   ÉTAPE 2  les changements.
-- Les étapes 1 et 2 sont dans une seule transaction : au moindre arrêt,
-- rien n'est modifié.
-- =============================================================================


-- ÉTAPE 0 — État actuel (lecture seule).

-- 0a. Version de Postgres : 15 ou plus attendu.
show server_version;

-- 0b. Les règles RLS en place. Attendu : une par table, nommée
--     « <table>: propriétaire seulement ». Si les noms diffèrent, le
--     dire avant de lancer la suite : l'étape 2 ne remplace que celles-là.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 0c. Séances rattachées au parcours d'un autre compte. Attendu : 0 ligne.
select s.id as seance, s.user_id as compte_seance, g.user_id as compte_parcours
from public.sessions s
join public.goals g on g.id = s.goal_id
where s.user_id <> g.user_id;


begin;

-- ÉTAPE 1 — Contrôle préalable, avec un message lisible.
do $$
declare
  n bigint;
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'Migration 07 arrêtée, rien n''a été modifié : Postgres 15 ou plus requis (« on delete set null (goal_id) »).';
  end if;
  select count(*) into n
  from public.sessions s join public.goals g on g.id = s.goal_id
  where s.user_id <> g.user_id;
  if n > 0 then
    raise exception 'Migration 07 arrêtée, rien n''a été modifié : % séance(s) rattachée(s) au parcours d''un autre compte (voir l''étape 0c).', n;
  end if;
  raise notice 'Contrôle préalable : rien ne bloque.';
end $$;

-- ÉTAPE 2a — Rattachement : même parcours ET même compte.
-- La clé composée a besoin d'une contrainte unique sur (id, user_id).
-- id est déjà unique seul : celle-ci ne refuse donc aucune ligne.
alter table public.goals
  drop constraint if exists goals_id_user_id_key,
  add constraint goals_id_user_id_key unique (id, user_id);

alter table public.sessions
  drop constraint if exists sessions_goal_id_fkey,
  drop constraint if exists sessions_goal_owner_fkey,
  add constraint sessions_goal_owner_fkey
    foreign key (goal_id, user_id) references public.goals (id, user_id)
    on delete set null (goal_id);

-- ÉTAPE 2b — Les cinq règles, réécrites avec (select auth.uid()).
drop policy if exists "debriefs: propriétaire seulement" on public.debriefs;
create policy "debriefs: propriétaire seulement" on public.debriefs
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "goals: propriétaire seulement" on public.goals;
create policy "goals: propriétaire seulement" on public.goals
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "insights: propriétaire seulement" on public.insights;
create policy "insights: propriétaire seulement" on public.insights
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "profiles: propriétaire seulement" on public.profiles;
create policy "profiles: propriétaire seulement" on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "sessions: propriétaire seulement" on public.sessions;
create policy "sessions: propriétaire seulement" on public.sessions
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;


-- VÉRIFICATION 1 : la nouvelle clé du rattachement. Attendu : 1 ligne,
-- FOREIGN KEY (goal_id, user_id) ... ON DELETE SET NULL (goal_id).
select conname, pg_get_constraintdef(oid) as regle
from pg_constraint
where conrelid = 'public.sessions'::regclass and contype = 'f' and conname like '%goal%';

-- VÉRIFICATION 2 : les règles. Attendu : 5 lignes, rôle {authenticated},
-- avec « ( SELECT auth.uid() AS uid) » dans qual et with_check.
select tablename, policyname, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename;
