"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Goal } from "@/lib/types";
import { repo, uid } from "@/lib/repo";
import { goalFailureMessage, errorDetail, type GoalWriteAction } from "@/lib/errors";
import type { WriteFailure } from "@/lib/useTasks";

/**
 * Les parcours de l'utilisateur.
 *
 * La création attend l'écriture avant d'afficher : un parcours affiché
 * mais absent de la base pourrait être choisi dans un formulaire, et la
 * session partirait avec un goal_id inconnu — violation de clé
 * étrangère, deuxième échec en cascade. Créer un parcours est rare, la
 * demi-seconde d'attente ne coûte rien.
 *
 * Les modifications restent affichées d'abord, mais un échec restaure
 * explicitement l'état précédent, sans dépendre d'une relecture qui
 * peut elle aussi échouer.
 */
export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writeFailures, setWriteFailures] = useState<WriteFailure[]>([]);

  // Seule la lecture la plus récente compte : un « Réessayer » ou une
  // relecture après écriture ne doit pas être écrasé par une réponse plus
  // ancienne arrivée après lui. Même garde que useTasks.
  const reqId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const list = await repo.goals.all();
      if (id !== reqId.current) return;
      setGoals(list);
      setLoadError(null);
    } catch (e) {
      if (id !== reqId.current) return;
      setLoadError(errorDetail(e) ?? "erreur inconnue");
    } finally {
      if (id === reqId.current) setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reportWrite = useCallback((action: GoalWriteAction, title: string, e: unknown) => {
    setWriteFailures((prev) => [
      ...prev,
      { id: uid(), message: goalFailureMessage(action, title), detail: errorDetail(e) },
    ]);
  }, []);

  /** Renvoie false si l'écriture a échoué : le formulaire garde alors
   *  sa saisie au lieu de se vider. */
  const addGoal = useCallback(
    async (data: Pick<Goal, "title" | "why" | "targetDate">): Promise<boolean> => {
      const goal: Goal = { ...data, id: uid(), status: "active", createdAt: new Date().toISOString() };
      try {
        await repo.goals.save(goal);
      } catch (e) {
        reportWrite("goal_add", goal.title, e);
        return false;
      }
      setGoals((prev) => [...prev, goal]);
      return true;
    },
    [reportWrite]
  );

  const updateGoal = useCallback(
    async (previous: Goal, patch: Partial<Goal>) => {
      const next = { ...previous, ...patch };
      const swap = (g: Goal) => setGoals((list) => list.map((x) => (x.id === g.id ? g : x)));
      swap(next);
      try {
        await repo.goals.save(next);
      } catch (e) {
        swap(previous);
        reportWrite("status" in patch ? "goal_status" : "goal_edit", previous.title, e);
        await refresh();
      }
    },
    [refresh, reportWrite]
  );

  const dismissWriteFailure = useCallback((id: string) => {
    setWriteFailures((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { goals, ready, loadError, writeFailures, dismissWriteFailure, refresh, addGoal, updateGoal };
}
