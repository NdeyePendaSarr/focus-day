"use client";

import { useCallback, useEffect, useState } from "react";
import type { Goal } from "@/lib/types";
import { repo, uid } from "@/lib/repo";
import { goalFailureMessage, errorDetail, type GoalWriteAction } from "@/lib/errors";
import type { WriteFailure } from "@/lib/useTasks";

/**
 * Les parcours de l'utilisateur. Même contrat que useTasks : la
 * modification s'affiche avant l'écriture, et une écriture ratée n'est
 * pas rejouée — la liste est rechargée et le bandeau dit quoi refaire.
 */
export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writeFailures, setWriteFailures] = useState<WriteFailure[]>([]);

  const refresh = useCallback(async () => {
    try {
      setGoals(await repo.goals.all());
      setLoadError(null);
    } catch (e) {
      setLoadError(errorDetail(e) ?? "erreur inconnue");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persist = useCallback(
    async (goal: Goal, action: GoalWriteAction) => {
      setGoals((prev) =>
        prev.some((g) => g.id === goal.id)
          ? prev.map((g) => (g.id === goal.id ? goal : g))
          : [...prev, goal]
      );
      try {
        await repo.goals.save(goal);
      } catch (e) {
        setWriteFailures((prev) => [
          ...prev,
          { id: uid(), message: goalFailureMessage(action, goal.title), detail: errorDetail(e) },
        ]);
        await refresh();
      }
    },
    [refresh]
  );

  const addGoal = useCallback(
    async (data: Pick<Goal, "title" | "why" | "targetDate">) => {
      await persist(
        { ...data, id: uid(), status: "active", createdAt: new Date().toISOString() },
        "goal_add"
      );
    },
    [persist]
  );

  const updateGoal = useCallback(
    async (goal: Goal, patch: Partial<Goal>) => {
      await persist({ ...goal, ...patch }, "status" in patch ? "goal_status" : "goal_edit");
    },
    [persist]
  );

  const dismissWriteFailure = useCallback((id: string) => {
    setWriteFailures((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { goals, ready, loadError, writeFailures, dismissWriteFailure, refresh, addGoal, updateGoal };
}
