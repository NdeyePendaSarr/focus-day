# FocusDay — audit avant ouverture à des utilisateurs réels

Établi avant l'ouverture à un groupe. Trois niveaux : **bloquant** (ne pas
partager le lien sans), **important** (à faire dans les jours qui suivent),
**souhaitable** (quand le rythme le permet).

Le principe qui trie cette liste : à deux utilisateurs de confiance, un
défaut se contourne par un message WhatsApp. À vingt, il devient un
incident que tu découvres trop tard, ou jamais.

---

## Bloquant

### 1. Envoi d'emails — Brevo

Le service intégré de Supabase est plafonné à 2 emails/heure pour le
projet entier. Passé ce seuil, `signUp` réussit côté client mais aucun
email ne part : ni l'utilisateur ni toi n'êtes prévenus.

- Brevo → SMTP relay, adresse d'expéditeur validée
- Supabase → *Authentication → SMTP Settings*
- Remonter ensuite la limite dans *Authentication → Rate Limits*
  (30/heure par défaut avec SMTP externe)
- Tester avec une adresse extérieure à ton compte

### 2. Mot de passe oublié

Aucun écran aujourd'hui. Sur vingt personnes, un oubli survient dans la
première semaine, et le compte est définitivement inaccessible.

- `resetPasswordForEmail` + page `/reset`
- Dépend du point 1 : sans SMTP, le lien ne part pas

### 3. Les erreurs doivent être visibles

`useTasks` expose un champ `error` que rien n'affiche. Une écriture qui
échoue — réseau coupé, session expirée — est aujourd'hui silencieuse :
l'utilisateur croit avoir enregistré et perd sa saisie.

- Bandeau ou notification quand `error` n'est pas nul
- Idem pour les échecs de chargement des pages

**État au 19 octobre 2026.** Fait sur Ma journée et `/parcours` : les
échecs de lecture et d'écriture ont chacun leur bandeau, qui nomme
l'action non enregistrée. Reste ouvert :

- **Objectif fantôme dans `useTasks`.** Une modification s'affiche avant
  l'écriture ; en cas d'échec, seul le `refresh()` qui suit la retire.
  Si ce refresh échoue aussi (réseau coupé), l'objectif ou la
  modification reste à l'écran sans exister en base. Le bandeau « pas à
  jour » le signale, mais rien n'est restauré : on peut valider ou noter
  un objectif qui n'existe pas, et chaque geste produit un nouvel échec.
  Correctif : restaurer explicitement l'état précédent à l'échec, comme
  le fait `useGoals` (ajout retiré, modification annulée, suppression
  rétablie).
  **Fait le 20 octobre 2026** (765b21b) : à l'échec, l'état d'avant est
  restauré sans attendre la relecture — seuls les champs modifiés
  reviennent à leur valeur précédente. Testé contre Supabase avec
  l'écriture et la relecture en échec simultané : l'écran garde la
  valeur réellement en base.
- ~~Tableau de bord, Historique, Archives : un échec de chargement ne
  produit qu'un `console.error`.~~ **Fait le 20 octobre 2026.** Bandeau
  avec « Réessayer » ; tant que rien n'a pu être lu, il remplace l'état
  vide (« Aucune journée renseignée », « Aucun objectif archivé »), qui
  ferait croire à des données perdues. Aux Archives, l'échec d'une
  restauration ou d'une suppression est aussi signalé.
- **Écriture coupée par un rechargement.** Constaté au test réel du
  19 octobre : une séance validée puis la page rechargée dans la
  seconde n'a pas été enregistrée, sans aucun message — le bandeau
  disparaît avec la page. `updateTask` fait deux allers-retours (lecture
  `byId`, puis `save`) ; fermer l'onglet ou recharger entre les deux
  perd la saisie. Pistes : un avertissement `beforeunload` tant qu'une
  écriture est en cours, et/ou écrire sans relire d'abord.
  **Fait le 20 octobre 2026** (765b21b) : `repo.tasks.patch`, un UPDATE
  ciblé comme `setGoal` — seules les colonnes modifiées partent, en un
  seul aller-retour, sans relecture ni réécriture de la ligne entière ;
  et avertissement du navigateur tant qu'une écriture est en cours.
  Testé contre Supabase (validation, modification, archivage).
  **Confirmé en production le 20 octobre 2026** : séance réelle validée
  par la carte, `status = done`, `actual_source = panneau`, note
  enregistrée.
- **Bascules « prévu → manqué » : encore une réécriture de la ligne
  entière.** Au chargement de la journée, `useTasks.refresh()` enregistre
  les séances passées en « manqué » avec `saveMany`, c'est-à-dire un
  upsert de toutes les colonnes depuis la copie du navigateur. C'est le
  même schéma que celui éliminé de `updateTask` (et refusé pour le
  rattachement par lot) : si la base et la copie divergeaient, la copie
  écraserait la base. Sans danger aujourd'hui — la copie vient d'être lue
  dans le même `refresh()`, et seules les séances dont le statut change
  sont écrites — mais une écriture concurrente entre la lecture et
  l'upsert serait perdue. Correctif : un UPDATE ciblé de la seule colonne
  `status`, sur le modèle de `setGoal`. **À traiter après le 2 novembre**,
  pour ne pas toucher au chemin des séances pendant la fenêtre de mesure.

**Incident du 20 octobre 2026 — `PGRST303` « JWT issued at future ».**
Juste après une connexion en production, Ma journée affiche le bandeau
de lecture : « Ta journée n'a pas pu être chargée depuis le serveur »,
détail `[PGRST303] JWT issued at future`. Le jeton remis par le service
d'authentification de Supabase porte une heure d'émission en avance sur
l'horloge du service qui lit la base : décalage entre deux services de
Supabase, pas défaut de l'app. L'heure de Windows a été vérifiée côté
utilisatrice. « Réessayer » suffit, quelques secondes plus tard.

Le risque est sur les écritures : une séance validée dans ces secondes-là
échouerait, la note serait à retaper — de quoi pousser vers « sans note »
la fois suivante, et mesurer un bug au lieu du mécanisme.

- **Fait le 20 octobre 2026** (`lib/jwtRetry.ts`) : chaque appel à
  Supabase réessaie **une seule fois**, après deux secondes,
  **uniquement sur `PGRST303`**. Si le second essai échoue, le bandeau
  s'affiche comme avant. Sans risque de double écriture : `PGRST303` est
  un refus du jeton, prononcé avant toute exécution SQL. Ni la
  disposition du panneau ni le texte des boutons ne changent.
- **Si ça revient** : noter la date, l'heure et l'écran ici. Un bandeau
  `PGRST303` qui s'affiche malgré le réessai veut dire que le décalage
  dépasse deux secondes : à signaler au support Supabase avec l'heure.

**« Archiver » ne retire pas la carte de Ma journée.** Constaté le
20 octobre 2026 en testant le réessai : l'écriture part et réussit
(`archived = true` en base), mais la carte reste affichée jusqu'au
prochain rechargement, sans aucun message. Défaut antérieur (présent
dans 5e71014), pas une régression : `useTasks` garde l'objectif archivé
dans son état, et rien ne le filtre. Effet : on croit que le clic n'a
pas marché, on reclique. Correctif simple — retirer l'objectif de l'état
après un archivage réussi. Hors du panneau de validation, mais sur le
chemin des séances : à décider.

### 4. Politique de mot de passe

Supabase accepte 6 caractères par défaut.

- Porter à 8 minimum
- Activer la détection des mots de passe compromis
  (*Authentication → Policies*)

**État au 20 octobre 2026.** Côté app : 8 caractères minimum à
l'inscription et au nouveau mot de passe (`lib/password.ts`), avec une
indication sous le champ qui dit combien il en manque. Pas de règle de
composition (majuscule, chiffre, symbole) : la longueur compte davantage.
La connexion n'applique pas la règle, pour ne pas bloquer un compte créé
avec 6 caractères.

- Côté Supabase, *Authentication → Sign In / Providers → Email →
  Minimum password length* à 8 : c'est ce réglage qui fait foi, l'app ne
  fait qu'annoncer la règle.
- **Mots de passe compromis : impossible sur l'offre gratuite.** La
  vérification (HaveIBeenPwned) est réservée à l'offre Pro. À activer le
  jour d'un passage en Pro ; l'app traduit déjà le message d'erreur.

### 5. Longueurs maximales

Aucune limite côté client ni base. Une note de plusieurs mégaoctets est
acceptée telle quelle.

```sql
alter table public.sessions
  add constraint sessions_title_len check (char_length(title) <= 200),
  add constraint sessions_note_len  check (char_length(note)  <= 5000);
```

Plus `maxLength` sur les champs correspondants.

**État au 20 octobre 2026.** Migration `supabase/05_longueurs_max.sql` :
une contrainte de longueur sur chacune des 13 colonnes texte du schéma
public, avec un contrôle préalable qui s'arrête sans rien modifier si une
ligne dépasse. Limites choisies très au-dessus des saisies réelles
(note : 10 000 pour un maximum mesuré de 341). Côté app, `lib/limits.ts`
porte les mêmes valeurs ; chaque champ a son `maxLength` et un compteur
qui apparaît à 80 % de la limite, pour qu'aucune saisie ne soit coupée
sans prévenir.

- Exception jusqu'au 2 novembre : le panneau de validation
  (`ActualTimePanel`) n'a que le `maxLength`, sans compteur — sa
  disposition est gelée pendant la mesure. Ajouter le compteur ensuite.

---

## Important

### 6. Suppression de compte et de données

Un utilisateur doit pouvoir partir avec ses données ou les effacer. Ce
n'est pas qu'une question réglementaire : c'est ce qui rend acceptable
de confier son quotidien à une application tenue par une camarade.

- Export JSON de ses propres journées
- Suppression du compte (fonction Postgres `security definer`, appelée
  depuis l'app)

### 7. Dire qui peut lire les données

Tu as accès à toutes les journées de la classe via Supabase. C'est la
réalité de tout projet auto-hébergé, mais ils doivent le savoir **avant**
d'écrire, pas après.

- Une phrase sur la page de connexion
- Une page « Confidentialité » courte et honnête

### 8. Première expérience

Un nouvel inscrit arrive sur une journée vide et un tableau de bord à
0/14. Rien n'explique ce qu'est une estimation d'effort, ni pourquoi on
saisit un temps réel.

- Un premier objectif d'exemple, ou trois écrans d'introduction
- Ou une phrase contextuelle sur chaque écran vide

### 9. Inscriptions groupées

Supabase limite aussi par adresse IP. Une classe entière qui s'inscrit
depuis le même réseau verra les derniers bloqués.

- Étaler les inscriptions, ou prévenir

### 10. Fuite d'information à l'inscription

Le message « Un compte existe déjà avec cette adresse » confirme
l'existence d'un compte à quiconque teste une adresse.

- Message générique, ou activer la protection anti-énumération
  côté Supabase

### 11. Sauvegardes — devenu bloquant

L'offre gratuite de Supabase **n'inclut aucune sauvegarde** (vérifié dans
*Database → Backups* : « Free Plan does not include project backups »).
Ce ne sont plus seulement tes données.

**Incident du 20 octobre 2026.** En recréant un compte de test, le compte
principal a été supprimé par erreur depuis *Authentication → Users*.
Toutes les tables pointent vers `auth.users` avec `on delete cascade` :
la suppression a effacé en même temps séances, parcours, débriefs et
profil. Restauration faite depuis `sauvegarde.sessions_avant` (90
séances et leurs notes, copiées la veille avant le rattachement par lot) :
séances retrouvées, parcours recréés et rattachés à la main, **débriefs
perdus** (ils n'étaient pas copiés).

Leçons :
- **Supprimer un compte dans le tableau de bord efface toutes ses
  données, sans confirmation de la cascade.** Vérifier l'adresse deux
  fois ; ne jamais supprimer un compte qui n'est pas un compte de test.
- Une copie de `sessions` seule ne suffit pas : copier **toutes** les
  tables. Fichier prêt : `supabase/sauvegarde/sauvegarde_complete.sql`.
- Le faire **avant** toute opération risquée (migration, suppression,
  rattachement en masse) et au moins une fois par semaine.
- Vérifier une restauration au moins une fois : c'est fait, par la force
  des choses, le 20 octobre.

Reste à automatiser (export planifié hors de Supabase) avant d'ouvrir à
un groupe : une copie dans la même base ne protège pas d'une suspension
ou d'une suppression du projet.

### 11 bis. Biais de mesure vus sur Ma journée — après le 2 novembre

Relevés le 20 octobre 2026 sur une vraie séance (9 h – 19 h 30). Tous
touchent le chemin de validation ou les variantes mesurées : rien n'est
changé avant la fin de la fenêtre de mesure.

- **Le temps réel est prérempli avec l'estimation**
  (`ActualTimePanel`, `useState(formatDuration(reference))`). Valider
  sans retoucher enregistre l'estimation comme temps réel : la séance du
  20 octobre est sortie à 10 h 30 sur 10 h 30. C'est très probablement
  l'origine des « 80 % de temps réels égaux à l'estimation » détectés par
  `lib/lecture.ts`. Piste : champ vide, l'estimation en indication
  (« Tu avais prévu 10 h 30 »), comme dans le rattrapage.
  **Fait le 2 novembre 2026.** Champ vide, prévu en indication. Vide
  n'est pas zéro : enregistrer sans durée n'écrit rien et ramène le
  curseur dans le champ ; la question de la note reste affichée tant
  que la durée n'est pas un 0 explicite. Pas de raccourci « comme
  prévu », qui recréerait la recopie ; le raccourci « Chrono » reste.
  Les temps réels saisis avant cette date restent suspects : à lire
  avec `lib/lecture.ts`, qui les signale.
- **Deux façons de valider la même séance sur le même écran.** Une
  séance en cours dont le créneau est dépassé apparaît à la fois sur sa
  carte (« Terminer », `actual_source = panneau`) et dans le débrief du
  soir (« Valider », `rattrapage`). Rien ne dit laquelle utiliser : le
  choix de la variante devient un hasard d'écran, alors que c'est
  justement ce que l'on compare. Piste : le débrief ne liste que les
  séances qui ne sont plus visibles comme en cours, ou renvoie vers la
  carte.
- **Une estimation de 10 h 30 passe sans question.** Champ d'estimation
  vide = durée du créneau ; un créneau de 9 h à 19 h 30 donne « 10 h 30
  estimées », chiffre que le tableau de bord compare ensuite au réel.
  Piste : au-delà de 4 h environ, demander l'estimation au lieu de la
  déduire.

---

## Souhaitable

### 12. Suivi des erreurs

Aucune remontée aujourd'hui : un plantage chez un utilisateur reste
invisible. Sentry a une offre gratuite suffisante.

### 13. Sessions sur poste partagé

Si l'app est ouverte sur un ordinateur de salle, la session persiste.
Le bouton de déconnexion existe désormais — reste à le rendre évident.

### 14. États de chargement

Les pages affichent « Chargement… ». Des squelettes donneraient une
impression de rapidité, surtout sur connexion mobile moyenne.

---

## Déjà en place — à ne pas défaire

- **RLS active et vérifiée** sur les cinq tables, testée avec deux comptes
- **Vues en `security_invoker`** : la RLS s'applique aussi à travers elles
- **Clé secrète absente du frontend** — seule la clé publiable est exposée,
  ce qui est son rôle
- **`.env*` ignoré par git**
- **Pas de HTML injecté** : les notes sont stockées en Markdown et rendues
  sans `dangerouslySetInnerHTML`
- **`user_id` par défaut à `auth.uid()`** : le client ne peut pas écrire
  au nom d'un autre
- **CI** : lint, types, tests et build à chaque push

---

## Ordre suggéré

1. Brevo (1) — débloque le reste
2. Erreurs visibles (3) — le moins coûteux, le plus rentable
3. Mot de passe oublié (2)
4. Mot de passe et longueurs (4, 5)
5. Confidentialité et suppression (6, 7)
6. Première expérience (8)

Les points 1 à 5 sont une petite semaine de travail en s'y tenant. Le 8
peut attendre la deuxième vague d'utilisateurs.
