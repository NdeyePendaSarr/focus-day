"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, TaskStatus, GapReason } from "@/lib/types";
import { repo, uid } from "@/lib/repo";
import { todayISO, reconcileStatus, nowMinutes } from "@/lib/time";
import { writeFailureMessage, errorDetail, type WriteAction } from "@/lib/errors";

/** Une écriture qui a échoué. Elle n'est pas rejouée : la journée est
 *  rechargée depuis la base, et le message dit quoi refaire. */
export type WriteFailure = { id: string; message: string; detail?: string };

/** Rafraîchit "maintenant" chaque minute pour faire vivre la timeline. */
export function useNow() {
  const [now, setNow] = useState(() => nowMinutes());
  useEffect(() => {
    const id = setInterval(() => setNow(nowMinutes()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Même ordre que le dépôt : les créneaux nocturnes de la veille en tête. */
function sortForDay(list: Task[], date: string): Task[] {
  return [...list].sort((a, b) => {
    const key = (t: Task) => (t.date === date ? t.start : `-${t.start}`);
    return key(a).localeCompare(key(b));
  });
}

export function useTasks(date: string = todayISO()) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  // Deux natures d'erreur, deux états. Auparavant un seul champ : une
  // écriture ratée le remplissait, puis le refresh() qui suivait le vidait
  // dès que la relecture réussissait — l'échec disparaissait avant d'être vu.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writeFailures, setWriteFailures] = useState<WriteFailure[]>([]);

  // Nom de la tâche au moment de l'échec : après le refresh, une tâche
  // jamais enregistrée n'existe plus dans l'état.
  const tasksRef = useRef<Task[]>([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const reportWrite = useCallback((action: WriteAction, name: string, e: unknown) => {
    setWriteFailures((prev) => [
      ...prev,
      { id: uid(), message: writeFailureMessage(action, name), detail: errorDetail(e) },
    ]);
  }, []);

  const dismissWriteFailure = useCallback((id: string) => {
    setWriteFailures((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Les lectures sont maintenant asynchrones : deux refresh peuvent se
  // chevaucher. On ne garde que le résultat du plus récent, sinon une
  // réponse lente pourrait écraser un état plus à jour.
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const stored = await repo.tasks.byDate(date);
      const list = stored.map((t) => reconcileStatus(t));

      // Persiste les bascules planned -> missed. Auparavant : une écriture
      // par tâche à chaque affichage. Maintenant : un seul appel, et
      // uniquement pour les tâches réellement modifiées.
      const changed = list.filter((t, i) => t.status !== stored[i].status);
      if (changed.length > 0) await repo.tasks.saveMany(changed);

      if (id !== reqId.current) return; // un refresh plus récent a pris la main
      setTasks(list);
      setLoadError(null);
    } catch (e) {
      // Une lecture qui échoue (session expirée, réseau) ne doit pas faire
      // planter la page : on affiche l'erreur, on garde l'app utilisable.
      if (id !== reqId.current) return;
      setLoadError(errorDetail(e) ?? "erreur inconnue");
    } finally {
      if (id === reqId.current) setReady(true);
    }
  }, [date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addTask = useCallback(
    async (data: Omit<Task, "id" | "status" | "createdAt" | "date">) => {
      const task: Task = {
        ...data,
        id: uid(),
        date,
        status: "planned",
        createdAt: new Date().toISOString(),
      };
      // Affichage immédiat : l'écriture réseau se fait derrière. Attendre
      // la sauvegarde PUIS un rechargement complet faisait patienter
      // plusieurs secondes avant de voir apparaître son propre objectif.
      setTasks((prev) => sortForDay([...prev, task], date));
      try {
        await repo.tasks.save(task);
      } catch (e) {
        reportWrite("add", task.name, e);
        await refresh();
      }
      return task;
    },
    [date, refresh, reportWrite]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>, action: WriteAction = "edit") => {
      const name = patch.name ?? tasksRef.current.find((t) => t.id === id)?.name ?? "";
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      try {
        // byId au lieu de all().find() : une seule ligne lue, pas toute la table.
        const current = await repo.tasks.byId(id);
        // Ligne absente (supprimée ailleurs) : rien n'est écrit, et le
        // dire vaut mieux que de rendre la main en silence.
        if (!current) throw new Error("Cet objectif n'existe plus en base.");
        await repo.tasks.save({ ...current, ...patch });
      } catch (e) {
        reportWrite(action, name, e);
        await refresh();
      }
    },
    [refresh, reportWrite]
  );

  const setStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      const now = new Date().toISOString();
      const patch: Partial<Task> = { status };
      if (status === "in_progress") patch.startedAt = now;
      if (status === "done") patch.completedAt = now;
      await updateTask(id, patch, "status");
    },
    [updateTask]
  );

  /** Termine une tâche en enregistrant le réalisé dans la même écriture. */
  const completeTask = useCallback(
    async (id: string, actualMinutes: number, gapReason?: GapReason, note?: string) => {
      await updateTask(id, {
        status: "done",
        completedAt: new Date().toISOString(),
        actualMinutes,
        gapReason,
        ...(note ? { note } : {}),
      }, "complete");
    },
    [updateTask]
  );

  /** Enregistre la note. Chaîne vide = suppression. */
  const setNote = useCallback(
    async (id: string, note: string) => {
      await updateTask(id, { note: note || undefined }, "note");
    },
    [updateTask]
  );

  /** Rattrapage : renseigne le temps réel sans toucher au statut. */
  const setActual = useCallback(
    async (id: string, actualMinutes: number, gapReason?: GapReason) => {
      await updateTask(id, { actualMinutes, gapReason }, "actual");
    },
    [updateTask]
  );

  /** Activité réalisée sans avoir été planifiée : pas de créneau,
   *  seulement une durée. C'est elle qui mesure le hors-plan. */
  const addUnplanned = useCallback(
    async (name: string, minutes: number, goalId?: string) => {
      const now = new Date().toISOString();
      const task: Task = {
        id: uid(),
        date,
        name,
        start: "",
        end: "",
        status: "done",
        origin: "unplanned",
        actualMinutes: minutes,
        goalId,
        createdAt: now,
        completedAt: now,
      };
      setTasks((prev) => sortForDay([...prev, task], date));
      try {
        await repo.tasks.save(task);
      } catch (e) {
        reportWrite("unplanned", name, e);
        await refresh();
      }
    },
    [date, refresh, reportWrite]
  );

  const removeTask = useCallback(
    async (id: string) => {
      const name = tasksRef.current.find((t) => t.id === id)?.name ?? "";
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await repo.tasks.remove(id);
      } catch (e) {
        reportWrite("remove", name, e);
        await refresh();
      }
    },
    [refresh, reportWrite]
  );

  const archiveTask = useCallback(
    async (id: string) => {
      await updateTask(id, { archived: true, archivedAt: new Date().toISOString() }, "archive");
    },
    [updateTask]
  );

  return { tasks, ready, loadError, writeFailures, dismissWriteFailure, addTask, updateTask, setStatus, completeTask, setNote, setActual, addUnplanned, removeTask, archiveTask, refresh };
}