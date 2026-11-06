"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { repo } from "@/lib/repo";
import { errorDetail } from "@/lib/errors";

/** Toutes les séances, en lecture seule (portfolio, liste des parcours). */
export function useAllTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seule la lecture la plus récente compte (voir useGoals).
  const reqId = useRef(0);
  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const list = await repo.tasks.all();
      if (id !== reqId.current) return;
      setTasks(list);
      setError(null);
    } catch (e) {
      if (id !== reqId.current) return;
      setError(errorDetail(e) ?? "erreur inconnue");
    } finally {
      if (id === reqId.current) setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { tasks, ready, error, reload: load };
}
