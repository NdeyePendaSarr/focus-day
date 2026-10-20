"use client";

import { useMemo } from "react";
import { useGoals } from "@/lib/useGoals";
import { useAllTasks } from "@/lib/useAllTasks";
import { buildPortfolio } from "@/lib/portfolio";

/** Parcours + toutes les séances, et le portfolio calculé. Lecture seule. */
export function usePortfolio() {
  const goalsState = useGoals();
  const tasksState = useAllTasks();

  const portfolio = useMemo(
    () => buildPortfolio(goalsState.goals, tasksState.tasks),
    [goalsState.goals, tasksState.tasks]
  );

  return {
    portfolio,
    goals: goalsState.goals,
    ready: goalsState.ready && tasksState.ready,
    loadError: goalsState.loadError ?? tasksState.error,
    retry: () => {
      void goalsState.refresh();
      void tasksState.reload();
    },
  };
}
