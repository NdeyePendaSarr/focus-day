-- =============================================================================
-- 04 — sessions.actual_source : par quel chemin le temps réel a été saisi
-- =============================================================================
--
-- La question « Qu'est-ce que tu en retiens ? » existe en deux variantes :
--   panneau     validation d'une séance : choix « avec ma note » / « sans note »
--   rattrapage  débrief du soir : question dépliée, rien d'exigé
--   hors_plan   activité non prévue : même choix que le panneau
-- Comparer leurs taux de notes suppose de savoir, ligne par ligne, quel
-- chemin a enregistré le temps. Le déduire du statut ne tiendrait pas.
--
-- Les lignes existantes restent à null : leur chemin est inconnu.
--
-- À LANCER AVANT le déploiement du code qui l'écrit : sans la colonne,
-- chaque enregistrement de séance échouerait (colonne inconnue).
-- =============================================================================

alter table public.sessions
  add column actual_source text
  constraint sessions_actual_source_check
  check (actual_source in ('panneau', 'rattrapage', 'hors_plan'));


-- VÉRIFICATION : la colonne existe, nullable, avec sa contrainte.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'sessions' and column_name = 'actual_source';
