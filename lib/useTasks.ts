"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, TaskStatus, GapReason } from "@/lib/types";
import { repo, uid } from "@/lib/repo";
import { todayISO, reconcileStatus, nowMinutes } from "@/lib/time";

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
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
    } catch (e) {
      // Une lecture qui échoue (session expirée, réseau) ne doit pas faire
      // planter la page : on affiche l'erreur, on garde l'app utilisable.
      if (id !== reqId.current) return;
      setError(e instanceof Error ? e.message : "Impossible de charger la journée.");
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
        setError(e instanceof Error ? e.message : "Enregistrement impossible.");
        await refresh();
      }
      return task;
    },
    [date, refresh]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      try {
        // byId au lieu de all().find() : une seule ligne lue, pas toute la table.
        const current = await repo.tasks.byId(id);
        if (!current) return;
        await repo.tasks.save({ ...current, ...patch });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Modification impossible.");
        await refresh();
      }
    },
    [refresh]
  );

  const setStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      const now = new Date().toISOString();
      const patch: Partial<Task> = { status };
      if (status === "in_progress") patch.startedAt = now;
      if (status === "done") patch.completedAt = now;
      await updateTask(id, patch);
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
      });
    },
    [updateTask]
  );

  /** Rattrapage : renseigne le temps réel sans toucher au statut. */
  const setActual = useCallback(
    async (id: string, actualMinutes: number, gapReason?: GapReason) => {
      await updateTask(id, { actualMinutes, gapReason });
    },
    [updateTask]
  );

  /** Activité réalisée sans avoir été planifiée : pas de créneau,
   *  seulement une durée. C'est elle qui mesure le hors-plan. */
  const addUnplanned = useCallback(
    async (name: string, minutes: number) => {
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
        createdAt: now,
        completedAt: now,
      };
      setTasks((prev) => sortForDay([...prev, task], date));
      try {
        await repo.tasks.save(task);
      } catch {
        await refresh();
      }
    },
    [date, refresh]
  );

  const removeTask = useCallback(
    async (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await repo.tasks.remove(id);
      } catch {
        await refresh();
      }
    },
    [refresh]
  );

  const archiveTask = useCallback(
    async (id: string) => {
      await updateTask(id, { archived: true, archivedAt: new Date().toISOString() });
    },
    [updateTask]
  );

  return { tasks, ready, error, addTask, updateTask, setStatus, completeTask, setActual, addUnplanned, removeTask, archiveTask, refresh };
}