/**
 * Calcul du portfolio : ce qui a été consacré à chaque parcours.
 *
 * Fonctions pures, sans accès aux données, pour être testées.
 *
 * Une séance compte dès qu'elle porte un temps réel non nul — séance
 * planifiée ou hors-plan, archivée ou non : une séance archivée a quand
 * même eu lieu. Une séance rattachée sans temps réel n'est PAS comptée
 * à zéro : « pas noté » n'est pas « pas fait ». Elle est seulement
 * signalée dans le détail.
 *
 * Les heures sont déclaratives : le vocabulaire affiché est « consacrées »,
 * jamais « mesurées » (docs/BRIEF-PIVOT.md §4).
 */

import type { Goal, GoalStatus, Task } from "./types";
import { dayOfMonth } from "./time";

export interface GoalSummary {
  goal: Goal;
  /** Séances comptées, de la plus ancienne à la plus récente. */
  sessions: Task[];
  minutes: number;
  activeDays: number;
  notes: number;
  firstDate?: string;
  lastDate?: string;
  /** Séances rattachées sans temps réel saisi : non comptées. */
  unmeasured: number;
}

const hasNote = (t: Task) => (t.note ?? "").trim() !== "";

export function summarize(goal: Goal, tasks: Task[]): GoalSummary {
  const linked = tasks.filter((t) => t.goalId === goal.id);
  const sessions = linked
    .filter((t) => (t.actualMinutes ?? 0) > 0)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  return {
    goal,
    sessions,
    minutes: sessions.reduce((s, t) => s + (t.actualMinutes ?? 0), 0),
    activeDays: new Set(sessions.map((t) => t.date)).size,
    notes: sessions.filter(hasNote).length,
    firstDate: sessions[0]?.date,
    lastDate: sessions[sessions.length - 1]?.date,
    unmeasured: linked.filter((t) => t.actualMinutes == null).length,
  };
}

export interface Portfolio {
  /** Parcours menés à terme : mis en avant, en tête. */
  done: GoalSummary[];
  active: GoalSummary[];
  /** En pause ou arrêtés. */
  other: GoalSummary[];
  /** Temps réel saisi sur des séances rattachées à aucun parcours. */
  unattachedMinutes: number;
}

const GROUP: Record<GoalStatus, keyof Omit<Portfolio, "unattachedMinutes">> = {
  done: "done",
  active: "active",
  paused: "other",
  abandoned: "other",
};

/** Activité la plus récente d'abord ; les parcours sans séance en dernier. */
function byRecency(a: GoalSummary, b: GoalSummary): number {
  return (b.lastDate ?? "").localeCompare(a.lastDate ?? "") || b.minutes - a.minutes;
}

export function buildPortfolio(goals: Goal[], tasks: Task[]): Portfolio {
  const result: Portfolio = { done: [], active: [], other: [], unattachedMinutes: 0 };
  for (const goal of goals) result[GROUP[goal.status]].push(summarize(goal, tasks));
  result.done.sort(byRecency);
  result.active.sort(byRecency);
  result.other.sort(byRecency);

  const known = new Set(goals.map((g) => g.id));
  result.unattachedMinutes = tasks
    .filter((t) => !t.goalId || !known.has(t.goalId))
    .reduce((s, t) => s + (t.actualMinutes ?? 0), 0);
  return result;
}

/* ------------------------------------------------------------------ */
/* Formulations                                                        */
/* ------------------------------------------------------------------ */

/** « 1 séance », « 3 séances » — singulier en dessous de deux. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n < 2 ? one : many}`;
}

/** Accord de « consacré » : « 1 h 30 consacrée », « 45 min consacrées ».
 *  Le nombre est fourni par l'appelant, qui le met en forme. */
export function consacre(minutes: number): string {
  return minutes >= 60 && minutes < 120 ? "consacrée" : "consacrées";
}

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long" });
const d = (iso: string) => new Date(iso + "T00:00:00");
/** « 1er » et non « 1 » : même règle que prettyDate, partout. */
const jour = (iso: string) => dayOfMonth(d(iso));
const jourMois = (iso: string) => `${jour(iso)} ${MONTH.format(d(iso))}`;
const complet = (iso: string) => `${jourMois(iso)} ${iso.slice(0, 4)}`;

/** « le 19 octobre 2026 », « du 3 septembre au 6 octobre 2026 »,
 *  « du 12 décembre 2025 au 4 janvier 2026 ». */
export function formatPeriod(first?: string, last?: string): string {
  if (!first || !last) return "";
  if (first === last) return `le ${complet(first)}`;
  if (first.slice(0, 4) === last.slice(0, 4)) {
    // Même mois : « du 19 au 21 octobre 2026 »
    if (first.slice(0, 7) === last.slice(0, 7)) return `du ${jour(first)} au ${complet(last)}`;
    return `du ${jourMois(first)} au ${complet(last)}`;
  }
  return `du ${complet(first)} au ${complet(last)}`;
}
