-- =============================================================================
-- Mesure du chantier 2 — taux de notes sur les séances rattachées à un parcours
-- =============================================================================
--
-- Critère (docs/BRIEF-PIVOT.md §4) : plus de 50 % de notes sur les séances
-- rattachées, deux semaines après la mise en ligne. En dessous, c'est le
-- mécanisme qu'il faut revoir, pas l'utilisateur.
--
-- À lancer dans l'éditeur SQL de Supabase. Il ne passe PAS par la RLS :
-- toutes les séances de tous les comptes sont lues, d'où le group by.
--
-- Variantes, enregistrées dans sessions.actual_source (migration 04) :
--   panneau     choix explicite « avec ma note » / « sans note »
--   rattrapage  question dépliée dans le débrief, rien d'exigé
--   hors_plan   choix explicite, comme le panneau
-- Les séances antérieures à la migration ont actual_source à null et
-- sont exclues.
--
-- Seule limite : une note ajoutée après coup par l'icône de la carte
-- compte pour la variante qui a validé le temps. Rare (7 % de notes sur
-- 36 jours, toutes voies confondues).
--
-- note_20 : notes d'au moins 20 caractères. L'écart avec avec_note mesure
-- les « ok » écrits pour ne pas prendre de risque.
-- =============================================================================

select
  u.email,
  s.actual_source                                                     as variante,
  count(*)                                                            as seances,
  count(*) filter (where trim(coalesce(s.note, '')) <> '')            as avec_note,
  count(*) filter (where char_length(trim(coalesce(s.note, ''))) >= 20) as note_20,
  round(100.0 * count(*) filter (where trim(coalesce(s.note, '')) <> '')
        / count(*), 1)                                                as pct_note,
  round(100.0 * count(*) filter (where char_length(trim(coalesce(s.note, ''))) >= 20)
        / count(*), 1)                                                as pct_note_20
from public.sessions s
left join auth.users u on u.id = s.user_id
where s.goal_id is not null
  and s.actual_source is not null
  and s.actual_minutes > 0          -- « Pas fait » : aucune question posée
group by u.email, s.actual_source
order by u.email, s.actual_source;
