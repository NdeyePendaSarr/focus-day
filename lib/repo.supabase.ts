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
 *   Task.goalId    <-> sessions.goal_id
 *   Goal.targetDate <-> goals.target_date
 */

import type { Task, TaskStatus, DebriefEntry, Goal, GoalStatus } from "@/lib/types";
import type { Repo, TaskRepo, DebriefRepo, GoalRepo } from "@/lib/repo";
import { spillsIntoNextDay, shiftISO } from "@/lib/time";
import { getSupabase, currentUserId } from "@/lib/supabase";
import { toPatchRow } from "@/lib/sessionPatch";
import { withJwtRetry } from "@/lib/jwtRetry";
import { fetchAllPages } from "@/lib/pagination";

/* ------------------------------------------------------------------ */
/* Conversion base <-> application                                     */
/* ------------------------------------------------------------------ */

type SessionRow = {
  id: string;
  goal_id: string | null;
  local_date: string;
  title: string;
  description: string | null;
  why: string | null;
  planned_start: string | null;
  planned_end: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  note: string | null;
  gap_reason: string | null;
  gap_note: string | null;
  origin: string;
  actual_source: string | null;
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
    description: r.description ?? undefined,
    why: r.why ?? undefined,
    start: hhmm(r.planned_start),
    end: hhmm(r.planned_end),
    estimatedMinutes: r.estimated_minutes ?? undefined,
    actualMinutes: r.actual_minutes ?? undefined,
    note: r.note ?? undefined,
    gapReason: (r.gap_reason ?? undefined) as Task["gapReason"],
    gapNote: r.gap_note ?? undefined,
    origin: (r.origin ?? "planned") as Task["origin"],
    goalId: r.goal_id ?? undefined,
    actualSource: (r.actual_source ?? undefined) as Task["actualSource"],
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
    description: t.description ?? null,
    why: t.why ?? null,
    planned_start: t.start || null,
    planned_end: t.end || null,
    status: t.status,
    estimated_minutes: t.estimatedMinutes ?? null,
    actual_minutes: t.actualMinutes ?? null,
    note: t.note ?? null,
    gap_reason: t.gapReason ?? null,
    gap_note: t.gapNote ?? null,
    origin: t.origin ?? "planned",
    goal_id: t.goalId ?? null,
    actual_source: t.actualSource ?? null,
    archived: t.archived ?? false,
    archived_at: t.archivedAt ?? null,
    started_at: t.startedAt ?? null,
    completed_at: t.completedAt ?? null,
    created_at: t.createdAt,
  };
}

const SESSION_COLS =
  "id, goal_id, local_date, title, description, why, planned_start, planned_end, estimated_minutes, actual_minutes, note, gap_reason, gap_note, origin, actual_source, status, archived, archived_at, started_at, completed_at, created_at";

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
    // Paginé : au-delà de 1 000 séances, une seule requête perdait les
    // plus récentes sans erreur (lib/pagination.ts). L'id en dernier
    // rend l'ordre total, condition pour que les pages ne se recoupent pas.
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await getSupabase()
        .from("sessions")
        .select(SESSION_COLS)
        .order("local_date", { ascending: true })
        .order("planned_start", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      if (error) fail(error);
      return data as SessionRow[];
    });
    return rows.map(toTask);
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
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await getSupabase()
        .from("sessions")
        .select(SESSION_COLS)
        .eq("archived", true)
        .order("archived_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (error) fail(error);
      return data as SessionRow[];
    });
    return rows.map(toTask);
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

  async patch(id, patch) {
    const row = toPatchRow(patch);
    if (Object.keys(row).length === 0) return;
    // UPDATE ciblé, jamais un upsert : seules les colonnes modifiées
    // partent. Auparavant, updateTask relisait la ligne (byId) puis la
    // renvoyait entière (save) : deux allers-retours, et une fenêtre plus
    // large pour qu'un rechargement de page coupe l'écriture.
    const { data, error } = await getSupabase()
      .from("sessions")
      .update(row)
      .eq("id", id)
      .select("id");
    if (error) fail(error);
    // La RLS filtre en silence : zéro ligne, c'est un échec à dire.
    if ((data ?? []).length !== 1) throw new Error("Cet objectif n'existe plus en base.");
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

  async setGoal(ids, goalId) {
    if (ids.length === 0) return 0;
    // UPDATE ciblé, jamais un upsert : seule la colonne goal_id est
    // envoyée, toutes les autres colonnes de ces lignes restent telles
    // qu'elles sont en base (le trigger sessions_touch avance updated_at).
    // Par paquets de 100 pour garder l'URL du filtre .in() raisonnable.
    let n = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data, error } = await getSupabase()
        .from("sessions")
        .update({ goal_id: goalId })
        .in("id", chunk)
        .select("id");
      if (error) fail(error);
      n += (data ?? []).length;
    }
    // La RLS filtre en silence : une séance d'un autre compte, ou déjà
    // supprimée, n'est simplement pas modifiée. Le dire plutôt que de
    // laisser croire que tout le lot est passé.
    if (n !== ids.length) {
      throw new Error(`${n} séance(s) modifiée(s) sur ${ids.length} demandées.`);
    }
    return n;
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
    mood: (r.mood ?? undefined) as DebriefEntry["mood"],
    createdAt: r.created_at,
  };
}

const DEBRIEF_COLS = "local_date, reached_goals, did_more, missing_note, mood, created_at";

const supabaseDebriefs: DebriefRepo = {
  async all() {
    // local_date est unique par compte, et la RLS ne laisse voir que le
    // sien : l'ordre est déjà total.
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await getSupabase()
        .from("debriefs")
        .select(DEBRIEF_COLS)
        .order("local_date", { ascending: true })
        .range(from, to);
      if (error) fail(error);
      return data as DebriefRow[];
    });
    return rows.map(toDebrief);
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

/* ------------------------------------------------------------------ */
/* Parcours (table goals)                                              */
/* ------------------------------------------------------------------ */

type GoalRow = {
  id: string;
  title: string;
  why: string | null;
  target_date: string | null;
  status: string;
  created_at: string;
};

const GOAL_COLS = "id, title, why, target_date, status, created_at";

function toGoal(r: GoalRow): Goal {
  return {
    id: r.id,
    title: r.title,
    why: r.why ?? undefined,
    targetDate: r.target_date ?? undefined,
    status: r.status as GoalStatus,
    createdAt: r.created_at,
  };
}

const supabaseGoals: GoalRepo = {
  async all() {
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await getSupabase()
        .from("goals")
        .select(GOAL_COLS)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      if (error) fail(error);
      return data as GoalRow[];
    });
    return rows.map(toGoal);
  },

  async save(goal) {
    const userId = await requireUserId();
    // updated_at est tenu par le trigger goals_touch.
    const { error } = await getSupabase().from("goals").upsert({
      id: goal.id,
      user_id: userId,
      title: goal.title,
      why: goal.why ?? null,
      target_date: goal.targetDate ?? null,
      status: goal.status,
      created_at: goal.createdAt,
    });
    if (error) fail(error);
  },
};

/* ------------------------------------------------------------------ */

// Chaque appel réessaie une fois, après deux secondes, si Supabase refuse
// le jeton comme « émis dans le futur » (PGRST303) — voir lib/jwtRetry.ts.
export const supabaseRepo: Repo = {
  tasks: withJwtRetry(supabaseTasks),
  debriefs: withJwtRetry(supabaseDebriefs),
  goals: withJwtRetry(supabaseGoals),
};
