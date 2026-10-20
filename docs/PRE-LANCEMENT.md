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
- Tableau de bord, Historique, Archives : un échec de chargement ne
  produit qu'un `console.error`.
- **Écriture coupée par un rechargement.** Constaté au test réel du
  19 octobre : une séance validée puis la page rechargée dans la
  seconde n'a pas été enregistrée, sans aucun message — le bandeau
  disparaît avec la page. `updateTask` fait deux allers-retours (lecture
  `byId`, puis `save`) ; fermer l'onglet ou recharger entre les deux
  perd la saisie. Pistes : un avertissement `beforeunload` tant qu'une
  écriture est en cours, et/ou écrire sans relire d'abord.

### 4. Politique de mot de passe

Supabase accepte 6 caractères par défaut.

- Porter à 8 minimum
- Activer la détection des mots de passe compromis
  (*Authentication → Policies*)

### 5. Longueurs maximales

Aucune limite côté client ni base. Une note de plusieurs mégaoctets est
acceptée telle quelle.

```sql
alter table public.sessions
  add constraint sessions_title_len check (char_length(title) <= 200),
  add constraint sessions_note_len  check (char_length(note)  <= 5000);
```

Plus `maxLength` sur les champs correspondants.

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
