"use client";

import { useCallback, useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { repo } from "@/lib/repo";
import { errorDetail } from "@/lib/errors";

/** Toutes les séances, en lecture seule (portfolio, liste des parcours). */
export function useAllTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await repo.tasks.all());
      setError(null);
    } catch (e) {
      setError(errorDetail(e) ?? "erreur inconnue");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { tasks, ready, error, reload: load };
}
