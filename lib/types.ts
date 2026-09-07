/**
 * Types du domaine FocusDay
 */

export type TaskStatus = "planned" | "in_progress" | "done" | "missed";

/** Cause d'un écart entre le prévu et le réalisé. Liste volontairement
 *  courte : au-delà de sept choix, la saisie devient un formulaire. */
export type GapReason =
  | "imprevu"
  | "mauvaise_estimation"
  | "distraction"
  | "fatigue"
  | "difficulte"
  | "changement_priorite"
  | "autre";

export const GAP_REASONS: { value: GapReason; label: string }[] = [
  { value: "imprevu", label: "Imprévu" },
  { value: "mauvaise_estimation", label: "Mal estimé" },
  { value: "distraction", label: "Distraction" },
  { value: "fatigue", label: "Fatigue" },
  { value: "difficulte", label: "Plus difficile" },
  { value: "changement_priorite", label: "Priorité changée" },
  { value: "autre", label: "Autre" },
];

export interface Task {
  id: string;
  date: string;        // "2026-08-01" — le jour de la tâche
  name: string;
  description?: string;
  why?: string;        // « pourquoi c'est important » — le cœur du concept
  start: string;       // "09:00"
  end: string;         // "10:30"
  status: TaskStatus;
  startedAt?: string;  // ISO — quand réellement commencée
  completedAt?: string;
  createdAt: string;   // ISO

  // --- Instrumentation prévu / réalisé / écart ---------------------
  /** Effort estimé, en minutes. Distinct de la durée du créneau :
   *  bloquer 6h30 d'après-midi n'est pas estimer 6h30 de travail. */
  estimatedMinutes?: number;
  /** Temps réellement passé, en minutes. Saisi, jamais déduit. */
  actualMinutes?: number;
  /** Note écrite après coup : ce qu'on a appris, retenu, ou voulu
   *  garder de cette tâche. Distincte de description (le plan) et de
   *  gapNote (la cause d'un écart). */
  note?: string;
  gapReason?: GapReason;
  gapNote?: string;
  /** "unplanned" : activité saisie après coup, jamais planifiée.
   *  C'est elle qui mesure la part de journée hors-plan. */
  origin?: "planned" | "unplanned";

  archived?: boolean;  // rangée hors de la journée active, sans être supprimée
  archivedAt?: string; // ISO
}

export interface DebriefEntry {
  date: string;                 // "2026-08-01"
  reachedGoals: boolean;        // ai-je atteint mes objectifs ?
  didMore: boolean;             // ai-je fait plus que prévu ?
  missingNote?: string;         // ce qui manque / ce que j'ai fait en plus
  mood?: 1 | 2 | 3 | 4 | 5;     // ressenti de la journée
  createdAt: string;
}

export interface DayStats {
  total: number;
  done: number;
  inProgress: number;
  missed: number;
  planned: number;
  successRate: number;          // 0–100
}
