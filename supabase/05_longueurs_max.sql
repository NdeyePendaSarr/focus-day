-- =============================================================================
-- 05 — Longueurs maximales des champs texte
-- =============================================================================
--
-- Aucune colonne texte n'avait de limite : une note de plusieurs mégaoctets
-- était acceptée telle quelle (docs/PRE-LANCEMENT.md §5). Les limites sont
-- larges : elles bloquent l'abus, pas l'usage.
--
--   colonne                  limite   max en production (20 oct. 2026)
--   sessions.note            10 000   341
--   sessions.title              200   107
--   sessions.description      1 000   262
--   sessions.why              1 000   113
--   sessions.gap_note         1 000     0
--   goals.title                 200    46
--   goals.why                 1 000     0
--   debriefs.missing_note     2 000   non mesuré : vérifié à l'étape 1
--   profiles.display_name       100
--   profiles.timezone            64
--   insights.title              200   table inutilisée par l'app
--   insights.body             5 000
--   insights.action_note      1 000
--
-- Pourquoi des CHECK plutôt que varchar(n) : changer une limite plus tard,
-- c'est supprimer et recréer une contrainte, sans réécrire la table ni
-- toucher aux vues qui lisent ces colonnes.
--
-- char_length compte les caractères (« é » = 1). Le maxLength des
-- formulaires compte en unités UTF-16, jamais moins : une saisie acceptée
-- par le formulaire l'est toujours par la base.
--
-- Les limites de l'app sont dans lib/limits.ts. Les deux doivent bouger
-- ensemble.
--
-- À LANCER AVANT le déploiement du code. Tout se passe dans une seule
-- transaction : si une seule ligne dépasse, rien n'est modifié.
-- =============================================================================

begin;

-- ÉTAPE 1 — Contrôle préalable. S'arrête avec un message lisible si une
-- ligne existante dépasse une limite, au lieu de l'erreur brute du CHECK.
do $$
declare
  c record;
  n bigint;
  pire integer;
  problemes text := '';
begin
  for c in
    select * from (values
      ('sessions', 'note',          10000),
      ('sessions', 'title',           200),
      ('sessions', 'description',    1000),
      ('sessions', 'why',            1000),
      ('sessions', 'gap_note',       1000),
      ('goals',    'title',           200),
      ('goals',    'why',            1000),
      ('debriefs', 'missing_note',   2000),
      ('profiles', 'display_name',    100),
      ('profiles', 'timezone',         64),
      ('insights', 'title',           200),
      ('insights', 'body',           5000),
      ('insights', 'action_note',    1000)
    ) as t(tab, col, lim)
  loop
    execute format(
      'select count(*), max(char_length(%I)) from public.%I where char_length(%I) > %s',
      c.col, c.tab, c.col, c.lim
    ) into n, pire;
    if n > 0 then
      problemes := problemes || format(E'\n  %s.%s : %s ligne(s) au-dessus de %s (la plus longue : %s)',
                                       c.tab, c.col, n, c.lim, pire);
    end if;
  end loop;

  if problemes <> '' then
    raise exception 'Migration 05 arrêtée, rien n''a été modifié :%', problemes;
  end if;
  raise notice 'Contrôle préalable : aucune ligne ne dépasse.';
end $$;

-- ÉTAPE 2 — Les contraintes. « drop if exists » d'abord : relancer le
-- fichier ne produit pas d'erreur « existe déjà ».
alter table public.sessions
  drop constraint if exists sessions_note_len,
  drop constraint if exists sessions_title_len,
  drop constraint if exists sessions_description_len,
  drop constraint if exists sessions_why_len,
  drop constraint if exists sessions_gap_note_len,
  add constraint sessions_note_len        check (char_length(note)        <= 10000),
  add constraint sessions_title_len       check (char_length(title)       <= 200),
  add constraint sessions_description_len check (char_length(description) <= 1000),
  add constraint sessions_why_len         check (char_length(why)         <= 1000),
  add constraint sessions_gap_note_len    check (char_length(gap_note)    <= 1000);

alter table public.goals
  drop constraint if exists goals_title_len,
  drop constraint if exists goals_why_len,
  add constraint goals_title_len check (char_length(title) <= 200),
  add constraint goals_why_len   check (char_length(why)   <= 1000);

alter table public.debriefs
  drop constraint if exists debriefs_missing_note_len,
  add constraint debriefs_missing_note_len check (char_length(missing_note) <= 2000);

alter table public.profiles
  drop constraint if exists profiles_display_name_len,
  drop constraint if exists profiles_timezone_len,
  add constraint profiles_display_name_len check (char_length(display_name) <= 100),
  add constraint profiles_timezone_len     check (char_length(timezone)     <= 64);

alter table public.insights
  drop constraint if exists insights_title_len,
  drop constraint if exists insights_body_len,
  drop constraint if exists insights_action_note_len,
  add constraint insights_title_len       check (char_length(title)       <= 200),
  add constraint insights_body_len        check (char_length(body)        <= 5000),
  add constraint insights_action_note_len check (char_length(action_note) <= 1000);

commit;


-- VÉRIFICATION : les 13 contraintes, avec leur règle. Attendu : 13 lignes.
select conrelid::regclass as table_, conname, pg_get_constraintdef(oid) as regle
from pg_constraint
where connamespace = 'public'::regnamespace
  and contype = 'c'
  and conname like '%\_len' escape '\'
order by 1, 2;
