-- =============================================================================
-- Sauvegarde complète — à lancer dans l'éditeur SQL de Supabase
-- =============================================================================
--
-- Pourquoi : l'offre gratuite n'a aucune sauvegarde, et supprimer un compte
-- efface toutes ses données en cascade (incident du 20 octobre 2026,
-- docs/PRE-LANCEMENT.md §11).
--
-- Quand : avant toute opération risquée (migration, suppression, rattachement
-- en masse), et au moins une fois par semaine.
--
-- Ce que ça fait : copie chaque table de l'app dans le schéma `sauvegarde`,
-- sous un nom daté (ex. sauvegarde.sessions_20261020). Les copies sont
-- indépendantes : supprimer un compte ne les touche pas.
--
-- Le schéma `sauvegarde` n'est pas exposé par l'API : personne ne peut le lire
-- depuis l'application. Il ne relève donc pas de la règle « aucune table du
-- schéma public sans RLS ».
--
-- Limite : la copie reste dans le même projet Supabase. Elle ne protège ni
-- d'une suspension ni d'une suppression du projet — pour cela, exporter aussi
-- en CSV (Table Editor → Export) ou par un dump externe.
-- =============================================================================

create schema if not exists sauvegarde;

do $$
declare
  jour   text := to_char(now(), 'YYYYMMDD');
  t      text;
  n      bigint;
begin
  foreach t in array array['profiles', 'goals', 'sessions', 'debriefs', 'insights'] loop
    -- Une copie par table et par jour : relancer le même jour ne l'écrase pas.
    if to_regclass(format('sauvegarde.%I', t || '_' || jour)) is not null then
      raise notice 'sauvegarde.%_% existe déjà, laissée telle quelle', t, jour;
      continue;
    end if;
    execute format('create table sauvegarde.%I as select * from public.%I', t || '_' || jour, t);
    execute format('select count(*) from sauvegarde.%I', t || '_' || jour) into n;
    raise notice 'sauvegarde.%_% : % lignes', t, jour, n;
  end loop;
end $$;

-- VÉRIFICATION : les copies du jour et leur nombre de lignes.
select table_name
from information_schema.tables
where table_schema = 'sauvegarde'
  and table_name like '%' || to_char(now(), 'YYYYMMDD')
order by table_name;
