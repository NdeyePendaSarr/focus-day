"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/lib/types";
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
      await repo.tasks.save(task);
      await refresh();
      return task;
    },
    [date, refresh]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      // byId au lieu de all().find() : une seule ligne lue, pas toute la table.
      const current = await repo.tasks.byId(id);
      if (!current) return;
      await repo.tasks.save({ ...current, ...patch });
      await refresh();
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

  const removeTask = useCallback(
    async (id: string) => {
      await repo.tasks.remove(id);
      await refresh();
    },
    [refresh]
  );

  const archiveTask = useCallback(
    async (id: string) => {
      await updateTask(id, { archived: true, archivedAt: new Date().toISOString() });
    },
    [updateTask]
  );

  return { tasks, ready, error, addTask, updateTask, setStatus, removeTask, archiveTask, refresh };
}