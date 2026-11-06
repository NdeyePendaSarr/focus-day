/**
 * Couche d'accès aux données — interface asynchrone.
 *
 * Remplace lib/store.ts. Même rôle, mais toutes les méthodes renvoient
 * une Promise : c'est ce qui permettra de brancher Supabase plus tard
 * sans retoucher un seul composant.
 *
 * ÉTAPE A : on garde localStorage derrière cette interface. L'app doit
 *           se comporter exactement comme avant.
 * ÉTAPE B : on ajoute supabaseRepo, qui satisfait la même interface.
 */

import type { Task, DebriefEntry, Goal } from "@/lib/types";
import { spillsIntoNextDay, shiftISO } from "@/lib/time";
import { supabaseRepo } from "@/lib/repo.supabase";

/* ------------------------------------------------------------------ */
/* Interface                                                           */
/* ------------------------------------------------------------------ */

export interface TaskRepo {
  all(): Promise<Task[]>;
  byDate(date: string): Promise<Task[]>;
  archived(): Promise<Task[]>;

  /**
   * Ajouté par rapport à store.ts : évite le `all().find()` de
   * useTasks.updateTask, qui téléchargerait toute la table à chaque
   * modification d'une seule tâche.
   */
  byId(id: string): Promise<Task | null>;

  save(task: Task): Promise<void>;

  /**
   * Modifie une séance existante : UPDATE ciblé, comme setGoal. Seules
   * les colonnes des champs présents dans `patch` sont envoyées ; les
   * autres restent telles qu'elles sont en base. Un seul aller-retour,
   * sans relecture préalable de la ligne.
   *
   * Échoue si aucune ligne n'a été modifiée (séance supprimée ailleurs,
   * ou filtrée par la RLS) : ne jamais laisser croire que c'est passé.
   */
  patch(id: string, patch: Partial<Task>): Promise<void>;

  /**
   * Bascule planned -> missed des séances dont le créneau est passé
   * (useTasks.refresh). UPDATE ciblé de la seule colonne status, et
   * seulement sur les lignes encore « planned » en base.
   *
   * Remplace saveMany, qui réécrivait chaque ligne entière depuis la
   * copie du navigateur : une note écrite entre-temps dans un autre
   * onglet était écrasée. Et une séance démarrée ou validée ailleurs
   * entre-temps n'est pas repassée à « manquée ».
   *
   * Renvoie le nombre de séances basculées. Moins que demandé n'est pas
   * une erreur : les autres ont changé de statut ailleurs, et c'est ce
   * statut-là qui compte.
   */
  markMissed(ids: string[]): Promise<number>;

  remove(id: string): Promise<void>;

  /**
   * Rattache des séances à un parcours (goalId null = les détacher).
   *
   * Ne modifie QUE le parcours de ces séances. save, lui, réécrit
   * toutes les colonnes que le modèle connaît à partir de la
   * copie du navigateur : sur un lot de séances anciennes, la moindre
   * divergence entre cette copie et la base serait écrasée d'un coup.
   *
   * Renvoie le nombre de séances modifiées ; échoue si ce n'est pas le
   * nombre demandé.
   */
  setGoal(ids: string[], goalId: string | null): Promise<number>;
}

export interface DebriefRepo {
  all(): Promise<DebriefEntry[]>;
  byDate(date: string): Promise<DebriefEntry | null>;
  save(entry: DebriefEntry): Promise<void>;
}

export interface GoalRepo {
  /** Tous les parcours, actifs ou non : l'historique doit pouvoir
   *  nommer ceux d'une formation terminée. */
  all(): Promise<Goal[]>;
  save(goal: Goal): Promise<void>;
}

export interface Repo {
  tasks: TaskRepo;
  debriefs: DebriefRepo;
  goals: GoalRepo;
}

/* ------------------------------------------------------------------ */
/* Implémentation localStorage                                         */
/* ------------------------------------------------------------------ */

const TASKS_KEY = "focusday.tasks";
const DEBRIEF_KEY = "focusday.debriefs";
const GOALS_KEY = "focusday.goals";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

const localTasks: TaskRepo = {
  async all() {
    return read<Task>(TASKS_KEY);
  },

  async byDate(date) {
    const yesterday = shiftISO(date, -1);
    return read<Task>(TASKS_KEY)
      .filter(
        (t) =>
          !t.archived &&
          (t.date === date ||
            // tâche d'hier qui déborde sur aujourd'hui (créneau nocturne)
            (t.date === yesterday && spillsIntoNextDay(t.start, t.end)))
      )
      .sort((a, b) => {
        // les tâches nocturnes d'hier passent en tête : elles sont
        // "en cours" depuis avant minuit, donc antérieures dans la journée
        const key = (t: Task) => (t.date === date ? t.start : `-${t.start}`);
        return key(a).localeCompare(key(b));
      });
  },

  async archived() {
    return read<Task>(TASKS_KEY)
      .filter((t) => t.archived)
      .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));
  },

  async byId(id) {
    return read<Task>(TASKS_KEY).find((t) => t.id === id) ?? null;
  },

  async patch(id, patch) {
    const tasks = read<Task>(TASKS_KEY);
    const i = tasks.findIndex((t) => t.id === id);
    if (i === -1) throw new Error("Cette séance n'existe plus.");
    tasks[i] = { ...tasks[i], ...patch };
    write(TASKS_KEY, tasks);
  },

  async save(task) {
    const tasks = read<Task>(TASKS_KEY);
    const i = tasks.findIndex((t) => t.id === task.id);
    if (i >= 0) tasks[i] = task;
    else tasks.push(task);
    write(TASKS_KEY, tasks);
  },

  async markMissed(ids) {
    if (ids.length === 0) return 0;
    const wanted = new Set(ids);
    let n = 0;
    const tasks = read<Task>(TASKS_KEY).map((t) => {
      if (!wanted.has(t.id) || t.status !== "planned") return t;
      n++;
      return { ...t, status: "missed" as const };
    });
    if (n > 0) write(TASKS_KEY, tasks);
    return n;
  },

  async remove(id) {
    write(
      TASKS_KEY,
      read<Task>(TASKS_KEY).filter((t) => t.id !== id)
    );
  },

  async setGoal(ids, goalId) {
    const wanted = new Set(ids);
    let n = 0;
    const tasks = read<Task>(TASKS_KEY).map((t) => {
      if (!wanted.has(t.id)) return t;
      n++;
      return { ...t, goalId: goalId ?? undefined };
    });
    if (n !== ids.length) throw new Error(`${n} séance(s) trouvée(s) sur ${ids.length} demandées.`);
    write(TASKS_KEY, tasks);
    return n;
  },
};

const localDebriefs: DebriefRepo = {
  async all() {
    return read<DebriefEntry>(DEBRIEF_KEY);
  },

  async byDate(date) {
    return read<DebriefEntry>(DEBRIEF_KEY).find((d) => d.date === date) ?? null;
  },

  async save(entry) {
    const list = read<DebriefEntry>(DEBRIEF_KEY);
    const i = list.findIndex((d) => d.date === entry.date);
    if (i >= 0) list[i] = entry;
    else list.push(entry);
    write(DEBRIEF_KEY, list);
  },
};

const localGoals: GoalRepo = {
  async all() {
    return read<Goal>(GOALS_KEY).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async save(goal) {
    const list = read<Goal>(GOALS_KEY);
    const i = list.findIndex((g) => g.id === goal.id);
    if (i >= 0) list[i] = goal;
    else list.push(goal);
    write(GOALS_KEY, list);
  },
};

export const localRepo: Repo = {
  tasks: localTasks,
  debriefs: localDebriefs,
  goals: localGoals,
};

/* ------------------------------------------------------------------ */
/* Sélection de l'implémentation                                       */
/* ------------------------------------------------------------------ */

/**
 * NEXT_PUBLIC_DATA_SOURCE=supabase bascule toute l'application sur
 * Postgres. Toute autre valeur (ou absence) garde localStorage.
 *
 * Les composants ne voient aucune différence : ils parlent à Repo.
 */
export function getRepo(): Repo {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? supabaseRepo : localRepo;
}

export const repo = getRepo();

/* ------------------------------------------------------------------ */

export function uid(): string {
  // randomUUID : natif, sans collision, dispo navigateur (contexte sûr) + Node 16+.
  // Repli sur l'ancienne méthode pour les rares environnements sans Web Crypto.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}