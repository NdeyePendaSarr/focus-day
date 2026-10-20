import type { Task } from "./types";

/**
 * Une modification de séance → les seules colonnes à écrire.
 *
 * Sert à repo.tasks.patch : un UPDATE ciblé, comme setGoal. Seules les
 * clés PRÉSENTES dans la modification deviennent des colonnes ; les
 * autres ne sont pas envoyées et restent telles qu'elles sont en base.
 *
 * Une clé présente avec la valeur undefined (« effacer la note ») est
 * envoyée comme null : même résultat qu'avant, quand la ligne entière
 * était réécrite à partir de { ...ligneLue, ...modification }.
 *
 * Les conversions sont celles de toRow (repo.supabase.ts), à l'identique :
 * la valeur écrite pour un champ donné ne change pas.
 */
const COLUMNS: { [K in keyof Task]?: (v: Task[K]) => [string, unknown] } = {
  date: (v) => ["local_date", v],
  name: (v) => ["title", v],
  description: (v) => ["description", v ?? null],
  why: (v) => ["why", v ?? null],
  start: (v) => ["planned_start", v || null],
  end: (v) => ["planned_end", v || null],
  status: (v) => ["status", v],
  estimatedMinutes: (v) => ["estimated_minutes", v ?? null],
  actualMinutes: (v) => ["actual_minutes", v ?? null],
  note: (v) => ["note", v ?? null],
  gapReason: (v) => ["gap_reason", v ?? null],
  gapNote: (v) => ["gap_note", v ?? null],
  origin: (v) => ["origin", v ?? "planned"],
  goalId: (v) => ["goal_id", v ?? null],
  actualSource: (v) => ["actual_source", v ?? null],
  archived: (v) => ["archived", v ?? false],
  archivedAt: (v) => ["archived_at", v ?? null],
  startedAt: (v) => ["started_at", v ?? null],
  completedAt: (v) => ["completed_at", v ?? null],
};

export function toPatchRow(patch: Partial<Task>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof Task)[]) {
    const convert = COLUMNS[key] as ((v: unknown) => [string, unknown]) | undefined;
    // id et createdAt ne se modifient pas. Une clé inconnue est une
    // erreur de programmation : la refuser plutôt que de perdre la
    // valeur en silence.
    if (!convert) throw new Error(`Champ non modifiable : ${String(key)}`);
    const [column, value] = convert(patch[key]);
    row[column] = value;
  }
  return row;
}
