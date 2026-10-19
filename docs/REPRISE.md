# FocusDay — reprise de projet

Document de passation. À joindre au début d'une nouvelle conversation pour
qu'un assistant reprenne le projet sans repartir de zéro.

Dernière mise à jour : 7 septembre 2026.

---

## 1. Ce qu'est FocusDay

Une application de planification quotidienne qui mesure **l'écart entre ce
qui était prévu et ce qui a été fait**.

Ce n'est pas une liste de tâches. Le marché en est saturé — Todoist,
Notion, Motion, Sunsama — et une de plus n'aurait aucune raison d'exister.
La question à laquelle FocusDay répond est ailleurs :

> Est-ce que la façon dont je travaille réellement me rapproche de mes
> objectifs, et si non, pourquoi ?

**Concurrence à connaître.** Les gestionnaires de tâches ne mesurent pas
l'écart. Mais les traqueurs de temps intelligents — Rize, RescueTime,
Timely — le font déjà, avec en plus une capture automatique. La
différenciation ne peut donc pas être « on mesure l'écart ». Elle est à
chercher du côté de : le lien entre temps, actions et objectifs ; la
mesure du **hors-plan**, ce temps passé sur ce qui n'était pas prévu
qu'aucun concurrent ne montre ; et une philosophie de description plutôt
que de notation.

**Statut.** Projet personnel de Ndeye Penda SARR, développeuse frontend et
étudiante en Master 2 Business Intelligence. Destiné à devenir la pièce
maîtresse de son portfolio, avec une ouverture possible à des tiers — un
ami l'utilise déjà, une classe pourrait suivre d'ici fin septembre.

---

## 2. État technique

**Dépôt** `github.com/NdeyePendaSarr/focus-day` — branche `main`
**Production** `focus-day-nps.vercel.app`

**Pile** Next.js 16 (Turbopack, App Router), React 19, TypeScript,
Supabase (Postgres + Auth + RLS), Vitest (36 tests sur `lib/time.ts`),
ESLint. Styles : CSS global (`app/globals.css`) et styles en ligne.

**CI** GitHub Actions : `npm ci`, lint, `tsc --noEmit`, tests, build.
Elle a déjà attrapé des erreurs invisibles en local — apostrophes non
échappées en JSX, casse de fichier. Toujours lancer les quatre commandes
avant de pousser.

### Architecture des données

Tout passe par une interface asynchrone unique :

```
composants  ->  lib/repo.ts (interface Repo)
                     |
                     +-- localRepo (localStorage)
                     +-- supabaseRepo (Postgres)
```

Le choix se fait par `NEXT_PUBLIC_DATA_SOURCE` (`local` | `supabase`).
Aucun composant ne connaît Supabase. C'est ce qui a permis de migrer sans
toucher à l'interface, et ce qui permettrait d'en changer.

### Arborescence

```
app/
  page.tsx              Ma journée
  dashboard/page.tsx    Tableau de bord
  history/page.tsx      Historique
  archive/page.tsx      Archives — jamais retravaillé
  login/page.tsx        Connexion / inscription
  auth/callback/        Échange du code de confirmation
  globals.css           Palette, classes partagées
proxy.ts                Racine. Next 16 a renommé « middleware » en
                        « proxy » ; un middleware.ts résiduel serait
                        ignoré EN SILENCE, laissant les routes ouvertes.
lib/
  repo.ts               Interface Repo + implémentation localStorage
  repo.supabase.ts      Implémentation Postgres, conversions incluses
  supabase.ts           Client navigateur, instancié paresseusement
  useTasks.ts           Hook central, mises à jour optimistes
  time.ts               Logique horaire + parseDuration — tout est testé
  types.ts              Task, DebriefEntry, GapReason
components/
  TaskCard.tsx          Carte d'objectif, écart, actions
  ActualTimePanel.tsx   Saisie du temps réel à la validation
  DayCatchUp.tsx        Rattrapage du soir + hors-plan + récap du jour
  EveningDebrief.tsx    Débrief en deux colonnes
  DayTimeline.tsx       Ruban horaire
  NoteEditor.tsx        Éditeur de note, mode lecture seule
  DurationInput.tsx     Saisie de durée en langage naturel
  TaskForm.tsx, NavBar.tsx, ConfirmDialog.tsx
```

### Base de données

Tables : `profiles`, `goals`, `sessions`, `debriefs`, `insights`.
RLS active sur les cinq, vérifiée avec deux comptes en SQL **et** dans
l'application. Les vues sont en `security_invoker`.

`sessions` est la table centrale :

| colonne | rôle |
|---|---|
| `local_date`, `planned_start`, `planned_end` | dates et heures **locales**, jamais `timestamptz` |
| `planned_minutes` | colonne générée, gère le passage de minuit |
| `estimated_minutes` | effort estimé — **la référence des écarts** |
| `actual_minutes` | temps réellement passé, saisi |
| `gap_reason` | cause de l'écart, 7 valeurs |
| `note` | note libre en Markdown, écrite après coup |
| `origin` | `planned` ou `unplanned` (hors-plan) |

`goals`, `insights` et `gap_note` existent mais **ne sont utilisées nulle
part**. Créées par anticipation.

Vues : `v_day_summary`, `v_estimation_bias`, `v_completion_by_slot`,
`v_gap_reasons`, `v_goal_time`, `v_experiment_scorecard`. Elles
privilégient `estimated_minutes` sur `planned_minutes` — l'inverse
mesurerait la taille des blocs horaires, pas la capacité à estimer.

---

## 3. Ce qui fonctionne

**Ma journée** — grille deux colonnes au-dessus de 1024 px : rail collant
à gauche (date, compteurs, temps réalisé, timeline), objectifs et débrief
à droite. La timeline se cale sur les créneaux réels et passe après les
objectifs sur mobile. Chaque carte montre son écart prévu/réel et sa
cause. Le débrief s'organise en deux colonnes — les faits à gauche, le
ressenti à droite — avec rattrapage des temps manquants et saisie du
hors-plan.

**Tableau de bord** — 14 derniers jours. Jours renseignés, temps prévu,
réalisé, hors-plan. Graphique à échelle commune où les jours vides
restent vides et les jours planifiés non mesurés portent un trait
pointillé. Lecture en phrases qui refuse de conclure sous 5 objectifs
mesurés.

**Historique** — bilan par journée, écart par objectif, filtres
Tout / Dépassé / Plus rapide / Sans mesure, recherche incluant les notes,
notes consultables en lecture seule.

**Connexion** — page en deux panneaux avec illustration animée reprenant
les barres du tableau de bord, messages d'erreur traduits, déconnexion
dans la barre de navigation.

**Saisie des durées** — `90`, `1h30`, `1,5h`, `45min` sont tous acceptés,
partout, avec l'interprétation affichée sous le champ.

---

## 4. Le système visuel

Une refonte a eu lieu le 7 septembre. Les valeurs Tailwind par défaut ont
été abandonnées : elles se reconnaissent au premier coup d'œil et
signalent un projet non conçu.

**Trois registres, pas six couleurs.**

| variable | valeur | usage |
|---|---|---|
| `--color-brand` | `#5b5bd6` | identité, réalisé, repère « maintenant » |
| `--color-plan` | `#8b90a8` | le prévu — une référence, pas un acteur |
| `--color-amber` | `#d99a2b` | ce qui sort du plan : dépassement, hors-plan |
| `--color-mint` | `#3f9e79` | statut terminé |
| `--color-rose` | `#d9536a` | échec, erreur, action destructive |

Les teintes de signal sont désaturées pour accompagner l'indigo au lieu
de le concurrencer. Le fond sombre est passé de `#0f1420` à `#101114` :
l'ancien appartenait à la même famille que la marque et noyait l'accent.

**Autres décisions de forme**

- Largeur unique `.page-shell` (1280 px) sur la navigation et le contenu
- Une seule action pleine par carte, les autres s'effacent (`.chip-quiet`)
- Coche verte au lieu d'un texte barré sur les objectifs terminés
- Visages dessinés en SVG au lieu d'émojis pour l'humeur
- Aucune bibliothèque d'icônes : SVG en ligne, qui suivent `currentColor`

---

## 5. L'expérimentation de 21 jours

Voir `EXPERIENCE.md`. En résumé : utiliser FocusDay quotidiennement pour
répondre à une seule question — **les données produites changent-elles la
façon de travailler ?**

Quatre critères, fixés par écrit avant le début :

| # | critère | seuil |
|---|---|---|
| 1 | jours avec un réalisé saisi le jour même | ≥ 15 / 21 |
| 2 | insights jugés utiles, pas « je le savais déjà » | ≥ 3 |
| 3 | décisions de planification changées | ≥ 3 |
| 4 | envie de continuer en semaine 4 | oui |

**Au jour 21**, relire `EXPERIENCE.md` *avant* de regarder les données,
puis répondre aux quatre critères honnêtement.

- **Tous atteints** → il y a un noyau de valeur. Approfondir : capture
  semi-automatique, recommandations, piste B2B (écoles, centres de
  formation).
- **Le 1 échoue** → la saisie coûte trop cher. Problème de produit.
- **Le 2 échoue** → les données ne révèlent rien. Problème d'hypothèse.
- **Le 3 échoue** → savoir ne suffit pas à changer. C'est le plus grave :
  toute la proposition de valeur tombe.
- **Le 4 échoue seul** → il y a quelque chose, mais pas encore un produit.

**Pendant les 21 jours**, ne rien construire d'autre que ce qui gêne la
saisie. Un geste agaçant au jour 4 fait abandonner au jour 10.

⚠️ Le code n'est plus le goulot d'étranglement depuis un moment. La
réponse cherchée est dans les données collectées, et elle ne viendra pas
plus vite en ajoutant des écrans.

---

## 6. Ce qui reste

**Avant d'ouvrir à des tiers** — voir `PRE-LANCEMENT.md`. Cinq points
bloquants : SMTP Brevo, mot de passe oublié, affichage des erreurs,
politique de mot de passe, longueurs maximales. Puis confidentialité,
suppression de compte, première expérience.

Le plus urgent est **l'affichage des erreurs** : `useTasks` expose un
champ `error` que rien n'affiche. Une écriture qui échoue est aujourd'hui
silencieuse, et la saisie est perdue sans que personne le sache.

**Écrans non retravaillés** : Archives, formulaire de création.
**Non vérifié sur mobile** : tableau de bord, historique, et l'ensemble
de la nouvelle palette en thème clair.

---

## 7. Principes à ne pas défaire

Ces décisions ont été prises pour de bonnes raisons. Les défaire par
inadvertance ferait régresser le produit.

**Aucun pourcentage de réussite.** Ils ont tous été retirés. Un
pourcentage note la journée, deux durées la décrivent. La philosophie est
« comprendre avant de juger ».

**« Pas fait » et « pas noté » ne se confondent jamais.** Un jour
planifié sans temps réel n'est pas un jour à zéro. Le graphique le montre
par un trait pointillé, les totaux excluent ces jours.

**Un seuil sert à signaler, pas à filtrer.** Les 15 % mettent un écart en
évidence. Ils ne décident pas si l'écart existe — un objectif prévu 2 h
et fait en 1 h 45 reste plus rapide.

**Le chronomètre est proposé, jamais imposé.** Le temps écoulé depuis
« Démarrer » mesure l'intervalle entre deux clics, pas le travail. Le
défaut est l'estimation.

**Les notes sont du Markdown, jamais du HTML.** Pas de balisage à
assainir à l'affichage. Modifiables le jour même, en lecture seule
ensuite : une trace réécrite après coup n'est plus une trace.

**L'estimation suit le créneau tant qu'elle n'est pas saisie à la main.**
Allonger un créneau sans cela laissait une estimation fausse, sans signal.

**Les mutations s'affichent avant l'écriture réseau.** Attendre la
sauvegarde puis un rechargement complet faisait patienter plusieurs
secondes avant de voir son propre objectif.

---

## 8. Pièges rencontrés

- **L'horloge système.** Une horloge déréglée crée des objectifs au
  mauvais jour, sans aucun signal. Ne jamais changer l'heure du PC pour
  tester ; utiliser un compte séparé.
- **Les liens de confirmation sont à usage unique** et souvent ouverts
  par les antivirus de messagerie avant l'utilisateur. La confirmation
  aboutit, mais son clic trouve un jeton consommé.
- **Le service email intégré de Supabase** est plafonné à 2 emails/heure
  pour tout le projet. Au-delà, `signUp` réussit et rien ne part.
- **`box-sizing: border-box`** n'est appliqué qu'aux champs de saisie. Le
  généraliser à `*` serait plus propre mais demande de revérifier tous
  les écrans.
- **`min-width: 0`** est nécessaire sur les enfants de grille et de flex,
  sinon ils refusent de rétrécir. Safari donne une largeur minimale
  généreuse aux `input[type=time]`.
- **`flex-wrap` sans base explicite** : un titre long repousse le bloc
  voisin à la ligne au lieu de se comprimer. Utiliser `flex: 1 1 260px`.
- **Casse des noms de fichiers** : Windows l'ignore, le runner Linux non.
- **Un élément à hauteur nulle dessine quand même ses bordures.** C'est
  ce qui faisait apparaître un trait sur des jours sans aucun objectif.

---

## 9. Manière de travailler

Livraison par archives zip contenant les fichiers modifiés avec leurs
chemins, plus un `A-LIRE.txt` expliquant quoi remplacer et pourquoi.
Jamais le projet entier — cela écraserait le `.git` et un `node_modules`
construit ailleurs.

Toute modification est vérifiée par `tsc --noEmit`, ESLint et les tests
avant livraison. Le SQL éventuel s'exécute **avant** le code.

### Ordre de mise en production — migration, PUIS déploiement

`lib/repo.supabase.ts` écrit **chaque colonne** de `sessions` à chaque
enregistrement (`toRow`, upsert de la ligne entière). Une colonne
ajoutée côté code mais absente de la base fait donc échouer **toutes**
les écritures de séances, pas seulement la nouvelle fonctionnalité :
plus personne ne peut créer, valider ni noter un objectif en production.

1. Lancer la migration `supabase/NN_*.sql` dans l'éditeur Supabase.
2. Vérifier la colonne (chaque migration se termine par sa requête de
   vérification).
3. Seulement ensuite, pousser sur `main` — Vercel déploie au push.

Même règle pour un test local en `NEXT_PUBLIC_DATA_SOURCE=supabase` : le
serveur local écrit dans la base de production.

Cas vécu : `sessions.actual_source` (migration 04, 19 octobre 2026).

### Le schéma de référence

`supabase/historique/` contient l'instantané d'août : il a divergé de la
production (colonnes `note`, `description`, défaut `auth.uid()` sur
`user_id`) et n'est plus une source de confiance. Le schéma réel est
`supabase/schema.sql`, produit par un dump de la production :

```
npx supabase db dump --db-url "$env:SUPABASE_DB_URL" --schema public -f supabase/schema.sql
```

La chaîne de connexion reste dans une variable de la session PowerShell,
jamais dans un fichier ni dans le dépôt. Après chaque migration
appliquée, refaire le dump et le commiter : le diff git montre alors
tout écart avec la production au lieu de le laisser découvrir plus tard.

Commits en français, format conventionnel (`feat`, `fix`, `refactor`,
`style`, `docs`, `chore`), corps expliquant le *pourquoi*.

Le ton attendu : franc, avec un avis argumenté plutôt qu'une exécution
docile. Signaler les erreurs de conception, y compris les siennes — il y
en a eu plusieurs, et les nommer a fait gagner du temps à chaque fois.
