/**
 * Mode démo : FocusDay sans compte, avec un jeu de données fictif.
 *
 * Pourquoi : un recruteur qui ouvre le lien tombait sur la page de
 * connexion, et devait créer un compte puis confirmer son email pour
 * voir quoi que ce soit. Un compte de démo partagé aurait exposé la base
 * de production à n'importe qui. La démo tourne donc sur localStorage
 * (la couche Repo le permettait déjà) : chaque visiteur a sa copie, dans
 * son navigateur, et peut tout essayer sans rien casser chez personne.
 *
 * Activée par NEXT_PUBLIC_DEMO=1, sur un déploiement distinct de la
 * production (NEXT_PUBLIC_DATA_SOURCE n'y vaut pas « supabase »).
 *
 * Les données sont calculées à partir de la date et de l'heure du
 * visiteur : la démo a toujours l'air vivante (une séance faite, une en
 * cours, une à venir), quel que soit le jour où on l'ouvre.
 */

import type { DebriefEntry, Goal, GapReason, Task } from "./types";
import { shiftISO } from "./time";

export const IS_DEMO =
  process.env.NEXT_PUBLIC_DEMO === "1" && process.env.NEXT_PUBLIC_DATA_SOURCE !== "supabase";

/** Clés localStorage écrites par la démo (celles du dépôt local, plus
 *  un témoin), et effacées par « Réinitialiser la démo ». */
export const DEMO_KEYS = {
  tasks: "focusday.tasks",
  debriefs: "focusday.debriefs",
  goals: "focusday.goals",
  seeded: "focusday.demo",
  firstSteps: "focusday.premiers-pas-termines",
} as const;

export interface DemoData {
  goals: Goal[];
  tasks: Task[];
  debriefs: DebriefEntry[];
}

/* ------------------------------------------------------------------ */
/* Contenu fictif                                                      */
/* ------------------------------------------------------------------ */

const NOTES: Record<string, string[]> = {
  pbi: [
    "CALCULATE modifie le contexte de filtre : revoir ALL et REMOVEFILTERS.",
    "Relation inactive entre Ventes et Date : USERELATIONSHIP dans la mesure, pas dans le modèle.",
    "Power Query : filtrer avant de fusionner, sinon l'actualisation double de durée.",
    "Examen blanc : 68 %. Points faibles : sécurité au niveau des lignes et paramètres.",
    "Les mesures rapides génèrent du DAX lisible : bon point de départ pour comprendre TOTALYTD.",
    "Modèle en étoile : une table de dates marquée comme telle, sinon les fonctions temporelles mentent.",
  ],
  gda: [
    "Nettoyage dans Sheets : TRIM et SPLIT avant toute analyse, les espaces faussent les jointures.",
    "SQL BigQuery : COUNT(DISTINCT) coûte cher, APPROX_COUNT_DISTINCT suffit pour explorer.",
    "Étude de cas Cyclistic : les membres roulent en semaine, les occasionnels le week-end.",
    "R : ggplot2 se lit couche par couche, comme une phrase.",
    "Présentation finale : une question, trois graphiques, une recommandation. Pas plus.",
  ],
  sql: [
    "Fonctions de fenêtre : ROW_NUMBER pour dédoublonner, garder la plus récente par client.",
    "Un index ne sert pas si la colonne est enveloppée dans une fonction dans le WHERE.",
    "CTE récursive pour une hiérarchie de catégories : penser à la condition d'arrêt.",
  ],
  eng: [
    "Vocabulaire des offres d'emploi data : « stakeholder », « deliverable », « insight ».",
    "Pitch de 60 secondes enregistré : trop vite, ralentir sur les chiffres.",
  ],
};

const TITRES: Record<string, string[]> = {
  pbi: ["Module DAX : contexte de filtre", "Modélisation en étoile", "Power Query : transformations", "Examen blanc PL-300", "Visualisations et rapports", "Sécurité au niveau des lignes"],
  gda: ["Nettoyage des données", "SQL dans BigQuery", "Étude de cas Cyclistic", "Initiation à R", "Projet final et présentation"],
  sql: ["Fonctions de fenêtre", "Index et plans d'exécution", "Requêtes récursives"],
  eng: ["Vocabulaire technique", "Entretien en anglais"],
};

/** Écart réel / estimé, en boucle : jamais toujours égal, sinon le
 *  tableau de bord conclurait que le temps réel est recopié. Moyenne un
 *  peu au-dessus de 1,15 : la lecture affiche un biais (« tu passes en
 *  moyenne 1,2 fois le temps que tu estimes »), le cas le plus courant. */
const ECARTS = [1.3, 0.95, 1.15, 1.45, 1.05, 1.25, 1];
const CAUSES: Partial<Record<number, GapReason>> = { 3: "difficulte", 6: "imprevu" };

const p2 = (n: number) => String(n).padStart(2, "0");
/** Minutes -> "HH:MM", repliées sur 24 h. */
const hm = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
};
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const iso = (date: string, time = "08:00") => `${date}T${time}:00`;

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

/** Le jeu de données, pour une date et une heure données (minutes
 *  depuis minuit). Fonction pure : testée, et identique d'un appel à
 *  l'autre. */
export function buildDemoData(today: string, now: number): DemoData {
  const goals: Goal[] = [
    {
      id: "demo-pbi",
      title: "Certification Power BI (PL-300)",
      why: "Pour postuler aux offres de data analyst avec une certification reconnue.",
      targetDate: shiftISO(today, 30),
      status: "active",
      createdAt: iso(shiftISO(today, -22)),
    },
    {
      id: "demo-gda",
      title: "Google Data Analytics",
      why: "Les bases de l'analyse de données, de la question à la présentation.",
      status: "done",
      createdAt: iso(shiftISO(today, -40)),
    },
    {
      id: "demo-sql",
      title: "SQL avancé",
      why: "Écrire des requêtes qui tiennent sur de vrais volumes.",
      status: "active",
      createdAt: iso(shiftISO(today, -18)),
    },
    {
      id: "demo-eng",
      title: "Anglais technique",
      why: "Lire la documentation et passer un entretien sans stress.",
      status: "paused",
      createdAt: iso(shiftISO(today, -32)),
    },
  ];

  const tasks: Task[] = [];
  let n = 0;
  const counters: Record<string, number> = { pbi: 0, gda: 0, sql: 0, eng: 0 };

  /** Une séance passée, validée (ou manquée une fois sur neuf). */
  const passee = (date: string, cle: string, debut: number, duree: number) => {
    const k = counters[cle]++;
    const i = n++;
    const titres = TITRES[cle];
    const notes = NOTES[cle];
    const manquee = i % 9 === 8;
    const estime = duree;
    const ecart = ECARTS[i % ECARTS.length];
    const reel = round5(estime * ecart);
    const avecNote = i % 5 !== 2;
    tasks.push({
      id: `demo-s${p2(i)}`,
      date,
      name: titres[k % titres.length],
      start: hm(debut),
      end: hm(debut + duree),
      status: manquee ? "missed" : "done",
      estimatedMinutes: estime,
      ...(manquee
        ? {}
        : {
            actualMinutes: reel,
            actualSource: "panneau" as const,
            completedAt: iso(date, hm(debut + duree)),
            ...(CAUSES[i % ECARTS.length] ? { gapReason: CAUSES[i % ECARTS.length] } : {}),
            ...(avecNote ? { note: notes[k % notes.length] } : {}),
          }),
      origin: "planned",
      goalId: `demo-${cle}`,
      createdAt: iso(shiftISO(date, -1), "20:00"),
    });
  };

  // Les 35 derniers jours : environ cinq jours sur sept travaillés.
  for (let j = 35; j >= 1; j--) {
    if (j % 7 === 0 || j % 7 === 3) continue;
    const date = shiftISO(today, -j);
    if (j >= 15) passee(date, "gda", 9 * 60, 90);
    if (j <= 22) passee(date, "pbi", j % 2 ? 18 * 60 + 30 : 9 * 60 + 30, j % 2 ? 60 : 120);
    if (j <= 18 && j % 3 === 0) passee(date, "sql", 14 * 60, 75);
    if (j >= 24 && j <= 30) passee(date, "eng", 12 * 60 + 30, 45);
  }

  // Deux activités hors plan : une rattachée, une libre.
  const horsPlan = (j: number, name: string, minutes: number, goalId?: string, note?: string) => {
    const date = shiftISO(today, -j);
    tasks.push({
      id: `demo-h${j}`,
      date,
      name,
      start: "",
      end: "",
      status: "done",
      origin: "unplanned",
      actualMinutes: minutes,
      actualSource: "hors_plan",
      ...(goalId ? { goalId } : {}),
      ...(note ? { note } : {}),
      createdAt: iso(date, "21:00"),
      completedAt: iso(date, "21:00"),
    });
  };
  // Des jours travaillés : un jour avec seulement du hors-plan ferait
  // lire au tableau de bord plus de jours renseignés que planifiés.
  horsPlan(12, "Vidéo : les itérateurs DAX (SUMX, AVERAGEX)", 40, "demo-pbi",
    "SUMX évalue ligne par ligne : utile quand la mesure dépend de deux colonnes.");
  horsPlan(4, "Article sur dbt et les tests de données", 25);

  // Aujourd'hui : une séance faite, une en cours, une à venir. La séance
  // en cours englobe toujours l'heure du visiteur.
  const debutEnCours = Math.max(0, Math.floor((now - 20) / 5) * 5);
  const finEnCours = debutEnCours + 60;
  const debutFaite = debutEnCours >= 90 ? debutEnCours - 90 : debutEnCours + 120;
  const debutAVenir = Math.min(finEnCours + 30, 1430);
  tasks.push(
    {
      id: "demo-t1",
      date: today,
      name: "Révision DAX : CALCULATE et contexte",
      start: hm(debutFaite),
      end: hm(debutFaite + 60),
      status: "done",
      estimatedMinutes: 60,
      actualMinutes: 70,
      actualSource: "panneau",
      note: "Le contexte de ligne ne filtre rien tant qu'on ne le transforme pas avec CALCULATE.",
      goalId: "demo-pbi",
      origin: "planned",
      createdAt: iso(shiftISO(today, -1), "20:00"),
      completedAt: iso(today, hm(debutFaite + 70)),
    },
    {
      id: "demo-t2",
      date: today,
      name: "Fonctions de fenêtre : exercices",
      start: hm(debutEnCours),
      end: hm(finEnCours),
      status: "in_progress",
      estimatedMinutes: 60,
      goalId: "demo-sql",
      origin: "planned",
      createdAt: iso(shiftISO(today, -1), "20:00"),
      startedAt: iso(today, hm(debutEnCours)),
    },
    {
      id: "demo-t3",
      date: today,
      name: "Examen blanc PL-300, partie 2",
      start: hm(debutAVenir),
      end: hm(debutAVenir + 60),
      status: "planned",
      estimatedMinutes: 60,
      goalId: "demo-pbi",
      origin: "planned",
      createdAt: iso(shiftISO(today, -1), "20:00"),
    }
  );

  const debriefs: DebriefEntry[] = [
    { j: 1, reachedGoals: true, didMore: false, mood: 4, missingNote: "Bonne journée, l'examen blanc m'a rassurée sur le DAX." },
    { j: 2, reachedGoals: false, didMore: false, mood: 2, missingNote: "Fatiguée : la séance du soir n'a pas eu lieu." },
    { j: 5, reachedGoals: true, didMore: true, mood: 5 },
    { j: 6, reachedGoals: true, didMore: false, mood: 3 },
    { j: 9, reachedGoals: true, didMore: false, mood: 4 },
  ].map(({ j, ...rest }) => ({
    date: shiftISO(today, -j),
    createdAt: iso(shiftISO(today, -j), "21:30"),
    ...rest,
    mood: rest.mood as DebriefEntry["mood"],
  }));

  return { goals, tasks, debriefs };
}

/* ------------------------------------------------------------------ */
/* Stockage                                                            */
/* ------------------------------------------------------------------ */

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Écrit le jeu de données si ce navigateur ne l'a jamais reçu. Ne
 * remplace jamais l'existant : ce que le visiteur a essayé reste.
 * Renvoie true si quelque chose a été écrit.
 */
export function seedDemo(storage: Storage, today: string, now: number): boolean {
  if (storage.getItem(DEMO_KEYS.seeded)) return false;
  const d = buildDemoData(today, now);
  storage.setItem(DEMO_KEYS.goals, JSON.stringify(d.goals));
  storage.setItem(DEMO_KEYS.tasks, JSON.stringify(d.tasks));
  storage.setItem(DEMO_KEYS.debriefs, JSON.stringify(d.debriefs));
  storage.setItem(DEMO_KEYS.seeded, today);
  return true;
}

/** Efface tout ce que la démo a écrit ; le prochain chargement repart
 *  des données fictives, recalées sur le jour même. */
export function resetDemo(storage: Storage): void {
  for (const k of Object.values(DEMO_KEYS)) storage.removeItem(k);
}
