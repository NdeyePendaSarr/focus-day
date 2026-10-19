-- =============================================================================
-- INSTANTANÉ D'AOÛT 2026 — conservé pour l'historique, PAS une source de confiance.
-- La production a divergé depuis (colonnes note et description, défaut
-- auth.uid() sur user_id…). Le schéma réel est dans supabase/schema.sql.
-- Déjà appliqué en production : ne pas relancer.
-- =============================================================================

-- =============================================================================
-- FocusDay — correction des vues analytiques
-- =============================================================================
--
-- Les vues avaient été écrites avant l'introduction de estimated_minutes.
-- Elles faisaient coalesce(planned_minutes, estimated_minutes) : comme
-- planned_minutes est toujours renseigné dès qu'il y a un créneau,
-- l'estimation d'effort n'était jamais lue.
--
-- L'ordre est inversé : l'estimation d'abord, le créneau en repli.
--
--   estimated_minutes = ce que tu penses que la tâche demande
--   planned_minutes   = la place que tu lui as réservée dans la journée
--
-- C'est le premier qui mesure ta capacité à estimer. Le second ne dit
-- que la taille du bloc horaire.
-- =============================================================================


create or replace view public.v_day_summary with (security_invoker = on) as
select
  s.user_id,
  s.local_date,
  count(*) filter (where s.origin = 'planned')                       as sessions_prevues,
  count(*) filter (where s.origin = 'planned' and s.status = 'done') as sessions_terminees,
  coalesce(sum(coalesce(s.estimated_minutes, s.planned_minutes))
           filter (where s.origin = 'planned'), 0)                   as minutes_prevues,
  coalesce(sum(s.actual_minutes), 0)                                 as minutes_realisees,
  coalesce(sum(s.actual_minutes)
           filter (where s.origin = 'unplanned'), 0)                 as minutes_hors_plan,
  round(
    100.0 * count(*) filter (where s.origin = 'planned' and s.status = 'done')
    / nullif(count(*) filter (where s.origin = 'planned'), 0)
  , 1)                                                               as taux_achevement
from public.sessions s
group by s.user_id, s.local_date;


create or replace view public.v_estimation_bias with (security_invoker = on) as
select
  s.user_id,
  s.goal_id,
  g.title                                                       as objectif,
  count(*)                                                      as n_sessions,
  sum(coalesce(s.estimated_minutes, s.planned_minutes))         as minutes_prevues,
  sum(s.actual_minutes)                                         as minutes_realisees,
  round(
    sum(s.actual_minutes)::numeric
    / nullif(sum(coalesce(s.estimated_minutes, s.planned_minutes)), 0)
  , 2)                                                          as ratio
from public.sessions s
left join public.goals g on g.id = s.goal_id
where s.actual_minutes is not null
  and coalesce(s.estimated_minutes, s.planned_minutes) is not null
  and s.origin = 'planned'
group by s.user_id, s.goal_id, g.title;


create or replace view public.v_gap_reasons with (security_invoker = on) as
select
  s.user_id,
  s.gap_reason,
  count(*)                                                      as n_sessions,
  sum(greatest(
    coalesce(s.estimated_minutes, s.planned_minutes, 0) - coalesce(s.actual_minutes, 0)
  , 0))                                                         as minutes_perdues
from public.sessions s
where s.gap_reason is not null
group by s.user_id, s.gap_reason;


-- VÉRIFICATION
-- minutes_prevues doit maintenant refléter tes estimations, pas tes créneaux.
select local_date, sessions_prevues, minutes_prevues, minutes_realisees,
       minutes_hors_plan, taux_achevement
from public.v_day_summary
order by local_date desc
limit 5;
