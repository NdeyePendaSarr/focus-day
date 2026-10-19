-- =============================================================================
-- INSTANTANÉ D'AOÛT 2026 — conservé pour l'historique, PAS une source de confiance.
-- La production a divergé depuis (colonnes note et description, défaut
-- auth.uid() sur user_id…). Le schéma réel est dans supabase/schema.sql.
-- Déjà appliqué en production : ne pas relancer.
-- =============================================================================

-- =============================================================================
-- FocusDay v2 — Schéma initial
-- PostgreSQL 15+ / Supabase
-- =============================================================================
--
-- CONVENTIONS IMPORTANTES
--
--  1. Les dates et heures de planification sont LOCALES : `date` + `time`,
--     jamais `timestamptz`. Le fuseau est stocké dans profiles.timezone.
--     C'est ce qui évite structurellement le bug de décalage UTC.
--
--  2. Un créneau qui traverse minuit a planned_end < planned_start.
--     La colonne générée planned_minutes gère ce cas.
--
--  3. RLS activée sur toutes les tables : un utilisateur ne voit que ses lignes.
--     Les vues sont en security_invoker pour que la RLS s'applique aussi
--     à travers elles (sinon elles s'exécutent avec les droits du owner).
--
--  4. Vocabulaire :
--       goals    = objectif de fond, pluri-jours ("apprendre Python")
--       sessions = créneau d'une journée (ce que l'UI actuelle appelle "objectif")
--
-- =============================================================================


-- =============================================================================
-- 1. PROFILS
-- =============================================================================

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone     text        not null default 'Africa/Dakar',
  created_at   timestamptz not null default now()
);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 2. OBJECTIFS DE FOND
-- =============================================================================

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  why         text,                       -- la motivation, comme dans FocusDay v1
  target_date date,
  status      text not null default 'active'
              check (status in ('active', 'done', 'paused', 'abandoned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index goals_user_status_idx on public.goals (user_id, status);


-- =============================================================================
-- 3. SESSIONS — le cœur : PRÉVU / RÉALISÉ / ÉCART
-- =============================================================================

create table public.sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  goal_id           uuid references public.goals(id) on delete set null,
  local_date        date not null,
  title             text not null,
  why               text,

  ---------------------------------------------------------------- PRÉVU
  planned_start     time,
  planned_end       time,
  estimated_minutes int check (estimated_minutes > 0),

  -- Durée prévue déduite du créneau, minuit géré.
  planned_minutes   int generated always as (
    case
      when planned_start is null or planned_end is null then null
      when planned_end > planned_start
        then (extract(epoch from (planned_end - planned_start)) / 60)::int
      else (extract(epoch from (planned_end - planned_start)) / 60)::int + 1440
    end
  ) stored,

  ---------------------------------------------------------------- RÉALISÉ
  actual_minutes    int check (actual_minutes >= 0),
  started_at        timestamptz,   -- Task.startedAt
  completed_at      timestamptz,   -- Task.completedAt

  -- Vocabulaire identique à TaskStatus (lib/types.ts) : aucune conversion
  -- à faire lors de l'import du localStorage. 'partial' et 'skipped' sont
  -- les deux seuls ajouts de la V2.
  status            text not null default 'planned'
                    check (status in ('planned', 'in_progress', 'done',
                                      'partial', 'missed', 'skipped')),

  ---------------------------------------------------------------- ÉCART
  gap_reason        text check (gap_reason in (
                      'imprevu',
                      'mauvaise_estimation',
                      'distraction',
                      'fatigue',
                      'difficulte',
                      'changement_priorite',
                      'autre'
                    )),
  gap_note          text,

  -- 'unplanned' = activité saisie après coup, jamais planifiée.
  -- C'est cette ligne qui permet de mesurer la part du temps hors-plan.
  origin            text not null default 'planned'
                    check (origin in ('planned', 'unplanned')),

  -- Archivage existant : rangé hors de la journée active, sans suppression.
  -- Reste compté dans les analyses : une tâche archivée a quand même eu lieu.
  archived          boolean not null default false,
  archived_at       timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Une session doit être soit planifiée, soit réalisée. Pas ni l'un ni l'autre.
  constraint sessions_planned_or_actual check (
    planned_start is not null or actual_minutes is not null
  )
);

create index sessions_user_date_idx   on public.sessions (user_id, local_date);
create index sessions_user_goal_idx   on public.sessions (user_id, goal_id);
create index sessions_user_status_idx on public.sessions (user_id, status);


-- =============================================================================
-- 4. DÉBRIEF DU SOIR
-- =============================================================================

create table public.debriefs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  local_date    date not null,

  -- Champs repris tels quels de DebriefEntry (lib/types.ts).
  reached_goals boolean,
  did_more      boolean,
  missing_note  text,
  mood          smallint check (mood between 1 and 5),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, local_date)
);


-- =============================================================================
-- 5. updated_at automatique
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger goals_touch    before update on public.goals
  for each row execute function public.touch_updated_at();
create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();
create trigger debriefs_touch before update on public.debriefs
  for each row execute function public.touch_updated_at();


-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.goals    enable row level security;
alter table public.sessions enable row level security;
alter table public.debriefs enable row level security;

create policy "profiles: propriétaire seulement"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "goals: propriétaire seulement"
  on public.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sessions: propriétaire seulement"
  on public.sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "debriefs: propriétaire seulement"
  on public.debriefs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- =============================================================================
-- 7. VUES ANALYTIQUES — la matière de l'onglet "Analyse"
-- =============================================================================

-- 7.1 Résumé par journée : charge prévue vs réalisée, hors-plan, achèvement
create view public.v_day_summary with (security_invoker = on) as
select
  s.user_id,
  s.local_date,
  count(*) filter (where s.origin = 'planned')                      as sessions_prevues,
  count(*) filter (where s.origin = 'planned' and s.status = 'done') as sessions_terminees,
  coalesce(sum(coalesce(s.planned_minutes, s.estimated_minutes))
           filter (where s.origin = 'planned'), 0)                  as minutes_prevues,
  coalesce(sum(s.actual_minutes), 0)                                as minutes_realisees,
  coalesce(sum(s.actual_minutes)
           filter (where s.origin = 'unplanned'), 0)                as minutes_hors_plan,
  round(
    100.0 * count(*) filter (where s.origin = 'planned' and s.status = 'done')
    / nullif(count(*) filter (where s.origin = 'planned'), 0)
  , 1)                                                              as taux_achevement
from public.sessions s
group by s.user_id, s.local_date;


-- 7.2 Biais d'estimation par objectif.
--     ratio > 1 = tu sous-estimes systématiquement. ratio < 1 = tu surestimes.
create view public.v_estimation_bias with (security_invoker = on) as
select
  s.user_id,
  s.goal_id,
  g.title                                                       as objectif,
  count(*)                                                      as n_sessions,
  sum(coalesce(s.planned_minutes, s.estimated_minutes))         as minutes_prevues,
  sum(s.actual_minutes)                                         as minutes_realisees,
  round(
    sum(s.actual_minutes)::numeric
    / nullif(sum(coalesce(s.planned_minutes, s.estimated_minutes)), 0)
  , 2)                                                          as ratio
from public.sessions s
left join public.goals g on g.id = s.goal_id
where s.actual_minutes is not null
  and coalesce(s.planned_minutes, s.estimated_minutes) is not null
group by s.user_id, s.goal_id, g.title;


-- 7.3 Taux d'achèvement selon le moment de la journée
create view public.v_completion_by_slot with (security_invoker = on) as
select
  s.user_id,
  case
    when s.planned_start <  time '12:00' then 'matin'
    when s.planned_start <  time '18:00' then 'apres-midi'
    else                                      'soir'
  end                                                           as moment,
  count(*)                                                      as n_sessions,
  count(*) filter (where s.status = 'done')                     as terminees,
  round(100.0 * count(*) filter (where s.status = 'done')
        / nullif(count(*), 0), 1)                               as taux_achevement
from public.sessions s
where s.origin = 'planned' and s.planned_start is not null
group by s.user_id, 2;


-- 7.4 Distribution des causes d'écart et minutes perdues
create view public.v_gap_reasons with (security_invoker = on) as
select
  s.user_id,
  s.gap_reason,
  count(*)                                                      as n_sessions,
  sum(greatest(
    coalesce(s.planned_minutes, s.estimated_minutes, 0) - coalesce(s.actual_minutes, 0)
  , 0))                                                         as minutes_perdues
from public.sessions s
where s.gap_reason is not null
group by s.user_id, s.gap_reason;


-- 7.5 Temps réellement investi par objectif, par semaine.
--     goal_id null = temps qui ne contribue à aucun objectif déclaré.
create view public.v_goal_time with (security_invoker = on) as
select
  s.user_id,
  date_trunc('week', s.local_date)::date                        as semaine,
  s.goal_id,
  coalesce(g.title, '(sans objectif)')                          as objectif,
  sum(s.actual_minutes)                                         as minutes_realisees
from public.sessions s
left join public.goals g on g.id = s.goal_id
where s.actual_minutes is not null
group by s.user_id, 2, s.goal_id, g.title;


-- =============================================================================
-- 8. INSIGHTS — et instrumentation de l'expérimentation
-- =============================================================================
--
-- Deux rôles :
--   1. Stocker ce que le système a affirmé, avec son niveau de confiance,
--      pour ne jamais présenter une hypothèse comme une certitude.
--   2. Enregistrer ce que l'utilisateur en a fait. Sans ça, le critère
--      "les insights provoquent une action" n'est pas mesurable au jour 21.
--
-- =============================================================================

create table public.insights (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Hiérarchie de confiance : jamais une recommandation sur 3 jours de données.
  kind            text not null check (kind in (
                    'observation',     -- fait brut, vrai dès le jour 1
                    'tendance',        -- répétition constatée
                    'hypothese',       -- corrélation possible, à confirmer
                    'recommandation'   -- action proposée
                  )),
  title           text not null,
  body            text,

  -- Les chiffres qui ont produit l'insight, pour pouvoir le rejouer/auditer.
  evidence        jsonb,
  days_observed   int,     -- volume de données derrière l'affirmation
  period_start    date,
  period_end      date,

  shown_at        timestamptz,

  ---------------------------------------------------- VERDICT DE L'UTILISATEUR
  user_verdict    text check (user_verdict in (
                    'utile',
                    'deja_su',      -- vrai mais je le savais déjà : ne compte pas
                    'faux',
                    'inutile'
                  )),
  -- A-t-il changé une décision de planification ? C'est LE critère n°3.
  acted_on        boolean,
  action_note     text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index insights_user_created_idx on public.insights (user_id, created_at desc);

create trigger insights_touch before update on public.insights
  for each row execute function public.touch_updated_at();

alter table public.insights enable row level security;

create policy "insights: propriétaire seulement"
  on public.insights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- Tableau de bord de l'expérimentation : à consulter au jour 21.
create view public.v_experiment_scorecard with (security_invoker = on) as
select
  i.user_id,
  count(*)                                             as insights_affiches,
  count(*) filter (where i.user_verdict = 'utile')     as juges_utiles,
  count(*) filter (where i.user_verdict = 'deja_su')   as deja_connus,
  count(*) filter (where i.user_verdict = 'faux')      as juges_faux,
  count(*) filter (where i.acted_on)                   as ont_change_une_decision
from public.insights i
where i.shown_at is not null
group by i.user_id;
