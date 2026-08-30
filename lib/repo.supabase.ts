/**
 * Implémentation Supabase de l'interface Repo (voir lib/repo.ts).
 *
 * Aucun composant ne connaît ce fichier : ils parlent tous à l'interface.
 * C'est ce qui permet de basculer via NEXT_PUBLIC_DATA_SOURCE.
 *
 * Conversion de vocabulaire — le code garde ses noms, la base les siens :
 *   Task.name      <-> sessions.title
 *   Task.date      <-> sessions.local_date
 *   Task.start/end <-> sessions.planned_start / planned_end
 */

import type { Task, TaskStatus, DebriefEntry } from "@/lib/types";
import type { Repo, TaskRepo, DebriefRepo } from "@/lib/repo";
import { spillsIntoNextDay, shiftISO } from "@/lib/time";
import { getSupabase, currentUserId } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Conversion base <-> application                                     */
/* ------------------------------------------------------------------ */

type SessionRow = {
  id: string;
  local_date: string;
  title: string;
  why: string | null;
  planned_start: string | null;
  planned_end: string | null;
  status: string;
  archived: boolean;
  archived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

/** Postgres renvoie "09:00:00" pour un type time ; l'app manipule "09:00". */
const hhmm = (t: string | null): string => (t ? t.slice(0, 5) : "");

function toTask(r: SessionRow): Task {
  return {
    id: r.id,
    date: r.local_date,
    name: r.title,
    why: r.why ?? undefined,
    start: hhmm(r.planned_start),
    end: hhmm(r.planned_end),
    status: r.status as TaskStatus,
    createdAt: r.created_at,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    archived: r.archived,
    archivedAt: r.archived_at ?? undefined,
  };
}

function toRow(t: Task, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    local_date: t.date,
    title: t.name,
    why: t.why ?? null,
    planned_start: t.start,
    planned_end: t.end,
    status: t.status,
    origin: "planned",
    archived: t.archived ?? false,
    archived_at: t.archivedAt ?? null,
    started_at: t.startedAt ?? null,
    completed_at: t.completedAt ?? null,
    created_at: t.createdAt,
  };
}

const SESSION_COLS =
  "id, local_date, title, why, planned_start, planned_end, status, archived, archived_at, started_at, completed_at, created_at";

/**
 * Supabase renvoie des objets d'erreur simples, pas des instances d'Error.
 * Les propager tels quels donne "[object Object]" dans l'overlay Next.
 * On les convertit en vraies Error avec un message exploitable.
 */
type SupabaseErrorLike = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

function fail(error: SupabaseErrorLike): never {
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  const text = parts.length > 0 ? parts.join(" — ") : "erreur Supabase inconnue";
  throw new Error(error.code ? `[${error.code}] ${text}` : text);
}

async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error("Aucune session active : reconnecte-toi.");
  return id;
}

/* ------------------------------------------------------------------ */
/* Tâches                                                              */
/* ------------------------------------------------------------------ */

const supabaseTasks: TaskRepo = {
  async all() {
    const { data, error } = await getSupabase()
      .from("sessions")
      .select(SESSION_COLS)
      .order("local_date", { ascending: true })
      .order("planned_start", { ascending: true });
    if (error) fail(error);
    return (data as SessionRow[]).map(toTask);
  },

  async byDate(date) {
    const yesterday = shiftISO(date, -1);
    // On demande les deux jours : une tâche d'hier peut déborder après minuit.
    const { data, error } = await getSupabase()
      .from("sessions")
      .select(SESSION_COLS)
      .in("local_date", [date, yesterday])
      .eq("archived", false);
    if (error) fail(error);

    return (data as SessionRow[])
      .map(toTask)
      .filter((t) => t.date === date || spillsIntoNextDay(t.start, t.end))
      .sort((a, b) => {
        const key = (t: Task) => (t.date === date ? t.start : `-${t.start}`);
        return key(a).localeCompare(key(b));
      });
  },

  async archived() {
    const { data, error } = await getSupabase()
      .from("sessions")
      .select(SESSION_COLS)
      .eq("archived", true)
      .order("archived_at", { ascending: false });
    if (error) fail(error);
    return (data as SessionRow[]).map(toTask);
  },

  async byId(id) {
    const { data, error } = await getSupabase()
      .from("sessions")
      .select(SESSION_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) fail(error);
    return data ? toTask(data as SessionRow) : null;
  },

  async save(task) {
    const userId = await requireUserId();
    const { error } = await getSupabase().from("sessions").upsert(toRow(task, userId));
    if (error) fail(error);
  },

  async saveMany(tasks) {
    if (tasks.length === 0) return;
    const userId = await requireUserId();
    // Un seul aller-retour, quel que soit le nombre de tâches.
    const { error } = await getSupabase()
      .from("sessions")
      .upsert(tasks.map((t) => toRow(t, userId)));
    if (error) fail(error);
  },

  async remove(id) {
    const { error } = await getSupabase().from("sessions").delete().eq("id", id);
    if (error) fail(error);
  },
};

/* ------------------------------------------------------------------ */
/* Débriefs                                                            */
/* ------------------------------------------------------------------ */

type DebriefRow = {
  local_date: string;
  reached_goals: boolean | null;
  did_more: boolean | null;
  missing_note: string | null;
  mood: number | null;
  created_at: string;
};

function toDebrief(r: DebriefRow): DebriefEntry {
  return {
    date: r.local_date,
    reachedGoals: r.reached_goals ?? false,
    didMore: r.did_more ?? false,
    missingNote: r.missing_note ?? undefined,
    mood: (r.mood ?? 3) as DebriefEntry["mood"],
    createdAt: r.created_at,
  };
}

const DEBRIEF_COLS = "local_date, reached_goals, did_more, missing_note, mood, created_at";

const supabaseDebriefs: DebriefRepo = {
  async all() {
    const { data, error } = await getSupabase()
      .from("debriefs")
      .select(DEBRIEF_COLS)
      .order("local_date", { ascending: true });
    if (error) fail(error);
    return (data as DebriefRow[]).map(toDebrief);
  },

  async byDate(date) {
    const { data, error } = await getSupabase()
      .from("debriefs")
      .select(DEBRIEF_COLS)
      .eq("local_date", date)
      .maybeSingle();
    if (error) fail(error);
    return data ? toDebrief(data as DebriefRow) : null;
  },

  async save(entry) {
    const userId = await requireUserId();
    // Un seul débrief par jour : contrainte unique (user_id, local_date).
    const { error } = await getSupabase().from("debriefs").upsert(
      {
        user_id: userId,
        local_date: entry.date,
        reached_goals: entry.reachedGoals,
        did_more: entry.didMore,
        missing_note: entry.missingNote ?? null,
        mood: entry.mood,
        created_at: entry.createdAt,
      },
      { onConflict: "user_id,local_date" }
    );
    if (error) fail(error);
  },
};

/* ------------------------------------------------------------------ */

export const supabaseRepo: Repo = {
  tasks: supabaseTasks,
  debriefs: supabaseDebriefs,
};
