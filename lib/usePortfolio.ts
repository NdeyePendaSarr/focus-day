"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { repo } from "@/lib/repo";
import { useGoals } from "@/lib/useGoals";
import { errorDetail } from "@/lib/errors";
import { buildPortfolio } from "@/lib/portfolio";

/** Parcours + toutes les séances, et le portfolio calculé. Lecture seule. */
export function usePortfolio() {
  const goalsState = useGoals();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksReady, setTasksReady] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setTasks(await repo.tasks.all());
      setTasksError(null);
    } catch (e) {
      setTasksError(errorDetail(e) ?? "erreur inconnue");
    } finally {
      setTasksReady(true);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const portfolio = useMemo(() => buildPortfolio(goalsState.goals, tasks), [goalsState.goals, tasks]);

  return {
    portfolio,
    goals: goalsState.goals,
    ready: goalsState.ready && tasksReady,
    loadError: goalsState.loadError ?? tasksError,
    retry: () => {
      void goalsState.refresh();
      void loadTasks();
    },
  };
}
