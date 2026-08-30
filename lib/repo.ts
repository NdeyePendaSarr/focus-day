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

import type { Task, DebriefEntry } from "@/lib/types";
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
   * Ajouté par rapport à store.ts : useTasks.refresh() persiste les
   * bascules planned -> missed dans une boucle. Avec Supabase, une
   * boucle = N requêtes réseau. Ici, un seul aller-retour.
   */
  saveMany(tasks: Task[]): Promise<void>;

  remove(id: string): Promise<void>;
}

export interface DebriefRepo {
  all(): Promise<DebriefEntry[]>;
  byDate(date: string): Promise<DebriefEntry | null>;
  save(entry: DebriefEntry): Promise<void>;
}

export interface Repo {
  tasks: TaskRepo;
  debriefs: DebriefRepo;
}

/* ------------------------------------------------------------------ */
/* Implémentation localStorage                                         */
/* ------------------------------------------------------------------ */

const TASKS_KEY = "focusday.tasks";
const DEBRIEF_KEY = "focusday.debriefs";

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

  async save(task) {
    const tasks = read<Task>(TASKS_KEY);
    const i = tasks.findIndex((t) => t.id === task.id);
    if (i >= 0) tasks[i] = task;
    else tasks.push(task);
    write(TASKS_KEY, tasks);
  },

  async saveMany(incoming) {
    if (incoming.length === 0) return;
    const tasks = read<Task>(TASKS_KEY);
    for (const task of incoming) {
      const i = tasks.findIndex((t) => t.id === task.id);
      if (i >= 0) tasks[i] = task;
      else tasks.push(task);
    }
    write(TASKS_KEY, tasks);
  },

  async remove(id) {
    write(
      TASKS_KEY,
      read<Task>(TASKS_KEY).filter((t) => t.id !== id)
    );
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

export const localRepo: Repo = {
  tasks: localTasks,
  debriefs: localDebriefs,
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