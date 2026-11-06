-- =============================================================================
-- 06 — Durée maximale d'une séance : 24 heures
-- =============================================================================
--
-- actual_minutes et estimated_minutes n'avaient qu'une borne basse. Une
-- faute de frappe (« 6000 » au lieu de « 60 ») était enregistrée telle
-- quelle : 100 h ajoutées au portfolio, sans que rien ne le signale.
--
-- Pourquoi 24 h : c'est la seule borne qui ne se discute pas. Un créneau
-- va au plus de minuit à minuit (planned_minutes ne dépasse jamais 1 440),
-- et une séance de plus d'une journée n'existe pas. Une borne plus basse
-- (12 h, 16 h) refuserait des journées réelles, rares mais possibles.
--
-- Les mêmes 24 h sont appliquées par l'app (MAX_DURATION_MINUTES dans
-- lib/time.ts). Les deux doivent bouger ensemble.
--
-- À LANCER AVANT ou APRÈS le déploiement du code, au choix : l'app ne
-- propose déjà plus d'enregistrer au-delà de 24 h.
--
-- Trois temps :
--   ÉTAPE 0  lecture seule : les plus longues durées déjà enregistrées.
--            À regarder AVANT de lancer la suite.
--   ÉTAPE 1  contrôle : s'arrête si une ligne dépasse 24 h.
--   ÉTAPE 2  les contraintes.
-- Les étapes 1 et 2 sont dans une seule transaction : si une seule ligne
-- dépasse, rien n'est modifié.
-- =============================================================================


-- ÉTAPE 0 — Les 15 plus longues durées, tous comptes confondus (l'éditeur
-- SQL ne passe pas par la RLS). Ce qui dépasse 24 h bloquera l'étape 1 ;
-- ce qui est sous 24 h mais suspect (13 h en une séance ?) mérite d'être
-- vérifié à la main, la contrainte ne le refusera pas.
select
  u.email,
  s.local_date,
  s.title,
  s.planned_start,
  s.planned_end,
  s.estimated_minutes,
  s.actual_minutes,
  s.actual_source,
  s.origin
from public.sessions s
join auth.users u on u.id = s.user_id
where s.actual_minutes is not null or s.estimated_minutes is not null
order by greatest(coalesce(s.actual_minutes, 0), coalesce(s.estimated_minutes, 0)) desc
limit 15;


begin;

-- ÉTAPE 1 — Contrôle préalable. S'arrête avec un message lisible si une
-- ligne existante dépasse, au lieu de l'erreur brute du CHECK.
do $$
declare
  n_reel bigint;
  n_estime bigint;
begin
  select count(*) into n_reel   from public.sessions where actual_minutes    > 1440;
  select count(*) into n_estime from public.sessions where estimated_minutes > 1440;
  if n_reel > 0 or n_estime > 0 then
    raise exception
      E'Migration 06 arrêtée, rien n''a été modifié :\n  % temps réel(s) et % estimation(s) au-dessus de 24 h.\n  Les corriger d''abord (voir l''étape 0).',
      n_reel, n_estime;
  end if;
  raise notice 'Contrôle préalable : aucune durée ne dépasse 24 h.';
end $$;

-- ÉTAPE 2 — Les contraintes. Elles s'ajoutent aux bornes basses
-- existantes (sessions_actual_minutes_check >= 0,
-- sessions_estimated_minutes_check > 0), sans les toucher.
-- « drop if exists » d'abord : relancer le fichier ne produit pas
-- d'erreur « existe déjà ».
alter table public.sessions
  drop constraint if exists sessions_actual_minutes_max,
  drop constraint if exists sessions_estimated_minutes_max,
  add constraint sessions_actual_minutes_max    check (actual_minutes    <= 1440),
  add constraint sessions_estimated_minutes_max check (estimated_minutes <= 1440);

commit;


-- VÉRIFICATION : les 4 contraintes sur les durées. Attendu : 4 lignes.
select conname, pg_get_constraintdef(oid) as regle
from pg_constraint
where conrelid = 'public.sessions'::regclass
  and contype = 'c'
  and conname similar to 'sessions_(actual|estimated)_minutes_%'
order by 1;
