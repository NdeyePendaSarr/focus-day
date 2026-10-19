# FocusDay — brief de développement

À lire avec `REPRISE.md` (état technique, architecture, principes, pièges).
Ce document-ci porte sur **ce qu'il faut construire maintenant et pourquoi**.

Rédigé le 19 octobre 2026, après dépouillement de 36 jours d'usage réel.

---

## 1. Ce que l'expérimentation a montré

FocusDay a été utilisé quotidiennement du **31 août au 6 octobre 2026**.
Les chiffres ci-dessous viennent de la base de production et justifient
toutes les décisions qui suivent.

| mesure | résultat | lecture |
|---|---|---|
| Jours planifiés | 23 | |
| Jours avec temps réel saisi | 22 (96 %) | la saisie **demandée** est remplie |
| Objectifs créés | 91 | |
| Notes écrites | 6 (7 %) | la saisie **optionnelle** ne l'est pas |
| Causes d'écart déclarées | 2 (2 %) | idem |
| Sessions hors-plan | **0** | idem |
| Ratio réalisé / prévu | **1,00** | l'écart n'existe pas |
| Total | 11 240 min prévues / 11 194 réalisées | |

### Trois conclusions

**L'hypothèse produit n'a pas été testée.** Le ratio de 1,00 signifie que
le temps réel était validé tel que pré-rempli. `actual_minutes` n'est donc
pas une mesure, c'est l'estimation recopiée. Et comme tout le produit
reposait sur l'écart entre les deux, l'écart était structurellement nul.
Défaut de conception, pas défaut d'usage.

**Ce que l'application demande est rempli, ce qu'elle propose ne l'est
pas.** 96 % contre 7 %. C'est l'enseignement le plus solide des 36 jours
et il gouverne le chantier 2 ci-dessous.

**L'usage réellement trouvé n'est pas celui qui était conçu.** Les six
notes portent toutes sur de la formation — Power BI, DAX, LLM, MLOps,
DataFlow360 — et l'utilisatrice a décroché la certification Google Data
Analytics pendant la période. Elle s'est servie de FocusDay comme carnet
de suivi d'apprentissage, pas comme instrument de mesure d'écart.

---

## 2. La décision

**FocusDay devient un carnet de suivi d'apprentissage qui produit un
portfolio.**

L'apprenant rattache ses objectifs à un *parcours* (une formation, une
certification, un projet). À tout moment, il peut montrer ce qu'il a
consacré à chacun : heures, régularité, période, et ce qu'il en a retenu.

Le suivi prévu/réalisé, l'historique et le tableau de bord sont
**conservés tels quels**. Ils deviennent le socle, ils ne sont plus la
promesse.

### Pourquoi ce pivot plutôt qu'un autre

Il vient d'un comportement observé, pas d'une hypothèse. C'est le seul
signal qu'ont produit 36 jours de données.

Le terrain « suivi d'étude » est déjà occupé — StudyTracker, TrackPrep,
Study-Track et d'autres font Pomodoro, syllabus, flashcards, rapports.
**Aucun ne produit de portfolio exploitable.** C'est la seule partie
réellement neuve, et donc la seule qui justifie le produit.

---

## 3. Ce qu'on ne construit PAS

Ces trois idées ont été écartées en connaissance de cause. Ne pas les
réintroduire sans que la décision soit rediscutée.

**Pas de tuteur IA.** Un apprenant qui bute sur son cours ouvre ChatGPT
ou Claude : ils le font mieux, gratuitement, avec plus de contexte. Un
chat intégré n'ajouterait rien et transformerait le produit en « app de
productivité avec IA », exactement ce que l'étude stratégique interdisait.

**Pas de score de maîtrise, pas de quiz évaluatif.** Un badge
« Power BI : maîtrisé, 85 % » auto-délivré par l'application ne vaut rien
pour un recruteur — contrairement à un badge Coursera ou Credly, émis par
l'institution et vérifiable. Pire, il pourrait faire croire à l'apprenant
qu'il maîtrise ce qu'il a survolé.

**Pas de recommandation de rattrapage pour l'instant.** « Tu as manqué
ceci, rattrape 2 h ce soir » suppose une mesure d'écart fiable, qui
n'existe pas aujourd'hui. Et cela réintroduirait la culpabilisation que
le produit évite par principe.

---

## 4. Les trois chantiers

Dans cet ordre. Chacun doit fonctionner avant d'attaquer le suivant.

### Chantier 1 — Rattacher un objectif à un parcours

La table `goals` existe depuis le premier jour et **n'a jamais été
utilisée**. `sessions.goal_id` existe aussi. Il manque uniquement
l'interface.

Une requête sur les données réelles a tenté de reconstituer les parcours
à partir des intitulés : 62 h sur 177 sont retombées dans « Autres ».
Les titres ne suffisent pas — d'où ce chantier.

À faire :
- Une page `/parcours` : créer, lister, archiver. Champs utiles déjà en
  base — `title`, `why`, `target_date`, `status`.
- Dans `TaskForm`, un sélecteur **« Parcours (optionnel) »** alimentant
  `goal_id`. Optionnel : tout ne relève pas d'une formation.
- Afficher le parcours sur la carte d'objectif et dans l'historique,
  discrètement — une étiquette, pas un bloc.
- Permettre de filtrer l'historique par parcours.

### Chantier 2 — La note devient une étape, plus une option

C'est le chantier décisif. Sans notes, le portfolio n'est qu'un relevé
d'heures et ne convaincra personne.

Aujourd'hui la note est derrière une icône : 7 % de remplissage. Le temps
réel est demandé à la validation : 96 %.

À faire :
- Dans `ActualTimePanel`, **si la session est rattachée à un parcours**,
  le champ note s'affiche déplié, avec la question « Qu'est-ce que tu en
  retiens ? ».
- Un bouton **« Passer »** explicite. On n'oblige pas, on demande.
- Hors parcours, le comportement actuel ne change pas : la note reste
  repliée. Une tâche de course n'a rien à retenir.

Critère de réussite : le taux de notes sur les sessions rattachées à un
parcours doit dépasser 50 % au bout de deux semaines. En dessous, c'est
le mécanisme qu'il faut revoir, pas l'utilisateur.

### Chantier 3 — La page portfolio

Route `/portfolio`. Une carte par parcours :

- heures **consacrées** (voir vocabulaire ci-dessous)
- nombre de sessions, période (première → dernière), jours actifs
- nombre de notes
- lien vers le détail : la liste des sessions et toutes les notes

La vue `v_goal_time` existe déjà et agrège les minutes par objectif et
par semaine.

Une page propre, imprimable. Pas d'export PDF maison, pas de partage
public pour l'instant — ce sont d'autres chantiers.

**Vocabulaire, et ce n'est pas un détail :** écrire « 48 h consacrées »,
jamais « 48 h mesurées » ni « maîtrisé ». Les heures sont déclaratives et
le ratio de 1,00 le prouve. Un portfolio honnête vaut mieux qu'un
portfolio impressionnant et contestable.

---

## 5. Points de vigilance

**La saisie n'est pas exhaustive.** Le portfolio affichera 20 h sur
Google Data Analytics alors que la certification en a demandé bien plus.
Tout outil déclaratif sous-estime. En tenir compte dans la formulation,
ne jamais présenter les totaux comme exhaustifs.

**Ne pas défaire les principes de `REPRISE.md`.** En particulier : aucun
pourcentage de réussite, « pas fait » ≠ « pas noté », un seuil signale
mais ne filtre pas, les notes sont du Markdown et deviennent lecture
seule dans l'historique.

**La liste de pré-lancement reste ouverte.** `PRE-LANCEMENT.md` recense
cinq points bloquants avant toute ouverture à des tiers — SMTP Brevo, mot
de passe oublié, affichage des erreurs, politique de mot de passe,
longueurs maximales. Le plus urgent reste l'affichage des erreurs :
`useTasks` expose un champ `error` que rien n'affiche, donc une écriture
qui échoue est silencieuse et la saisie est perdue.

**Supabase suspend les projets gratuits après une semaine d'inactivité.**
C'est arrivé en octobre. À régler avant d'ouvrir à un groupe.

---

## 6. Conventions

Vérifier avant chaque livraison : `npm run lint`, `npx tsc --noEmit`,
`npm test`, `npm run build`. La CI lance les quatre et a déjà attrapé des
erreurs invisibles en local.

Le SQL s'exécute **avant** le code qui en dépend.

Commits en français, format conventionnel, corps expliquant le *pourquoi*.
Aucune mention d'un assistant dans les commits : pas de `Co-Authored-By`,
pas de lien de session.

Signaler les erreurs de conception plutôt que d'exécuter sans discuter —
plusieurs ont été corrigées comme ça, et chacune a fait gagner du temps.
