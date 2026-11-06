"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  // Écritures en cours. Tant qu'il y en a une, quitter ou recharger la
  // page déclenche l'avertissement du navigateur : une séance validée
  // puis la page rechargée dans la seconde était perdue sans un mot
  // (test réel du 19 octobre 2026).
  const pending = useRef(0);
  const guard = useCallback((e: BeforeUnloadEvent) => {
    e.preventDefault();
    // Navigateurs plus anciens : returnValue doit être renseigné.
    e.returnValue = "";
  }, []);
  const track = useCallback(
    async <T,>(write: () => Promise<T>): Promise<T> => {
      if (pending.current++ === 0) window.addEventListener("beforeunload", guard);
      try {
        return await write();
      } finally {
        if (--pending.current === 0) window.removeEventListener("beforeunload", guard);
      }
    },
    [guard]
  );
  useEffect(() => () => window.removeEventListener("beforeunload", guard), [guard]);

  // Les lectures sont maintenant asynchrones : deux refresh peuvent se
  // chevaucher. On ne garde que le résultat du plus récent, sinon une
  // réponse lente pourrait écraser un état plus à jour.
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const stored = await repo.tasks.byDate(date);
      const list = stored.map((t) => reconcileStatus(t));
      const missedIds = list.filter((t, i) => t.status !== stored[i].status).map((t) => t.id);

      if (id !== reqId.current) return; // un refresh plus récent a pris la main
      // La journée s'affiche dès la lecture : elle n'attend plus
      // l'écriture des bascules, et n'en dépend plus.
      setTasks(list);
      setLoadError(null);

      // Persiste les bascules planned -> missed : UPDATE ciblé du seul
      // statut (repo.tasks.markMissed), plus la réécriture des lignes
      // entières qui pouvait écraser une note écrite dans un autre onglet.
      //
      // Un échec ici n'est pas affiché : l'utilisateur n'a rien à
      // refaire. « Manquée » est recalculé à chaque lecture, l'écran reste
      // juste, et l'écriture est retentée au prochain chargement de la
      // journée. Auparavant, cet échec jetait la lecture réussie : « Ta
      // journée n'a pas pu être chargée », liste vide.
      //
      // Hors de track() pour la même raison : quitter la page pendant
      // cette écriture ne perd rien, l'avertissement du navigateur serait
      // une fausse alerte sur une écriture que personne n'a demandée.
      if (missedIds.length > 0) {
        void repo.tasks.markMissed(missedIds).catch(() => {});
      }
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
        await track(() => repo.tasks.save(task));
      } catch (e) {
        // Restauration explicite, sans attendre le refresh : s'il échoue
        // aussi (réseau coupé), l'objectif resterait affiché sans exister.
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        reportWrite("add", task.name, e);
        await refresh();
      }
      return task;
    },
    [date, refresh, reportWrite, track]
  );

  /** Renvoie false si l'écriture a échoué : l'appelant peut alors rendre
   *  sa saisie à l'utilisateur au lieu de la perdre. */
  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>, action: WriteAction = "edit"): Promise<boolean> => {
      const before = tasksRef.current.find((t) => t.id === id);
      const name = patch.name ?? before?.name ?? "";
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      try {
        // UPDATE ciblé : seules les colonnes de `patch` partent, en un
        // seul aller-retour. Plus de relecture préalable de la ligne.
        await track(() => repo.tasks.patch(id, patch));
        return true;
      } catch (e) {
        // Restauration explicite des seuls champs modifiés, à leur valeur
        // d'avant : une autre modification de la même séance, faite
        // entre-temps, n'est pas écrasée.
        if (before) {
          const previous = Object.fromEntries(
            Object.keys(patch).map((k) => [k, before[k as keyof Task]])
          ) as Partial<Task>;
          setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...previous } : t)));
        }
        reportWrite(action, name, e);
        await refresh();
        return false;
      }
    },
    [refresh, reportWrite, track]
  );

  const setStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      const now = new Date().toISOString();
      const patch: Partial<Task> = { status };
      if (status === "in_progress") patch.startedAt = now;
      if (status === "done") patch.completedAt = now;
      return updateTask(id, patch, "status");
    },
    [updateTask]
  );

  /** Termine une tâche en enregistrant le réalisé dans la même écriture. */
  const completeTask = useCallback(
    async (id: string, actualMinutes: number, gapReason?: GapReason, note?: string) => {
      return updateTask(id, {
        status: "done",
        completedAt: new Date().toISOString(),
        actualMinutes,
        actualSource: "panneau",
        gapReason,
        ...(note ? { note } : {}),
      }, "complete");
    },
    [updateTask]
  );

  /** Enregistre la note. Chaîne vide = suppression. */
  const setNote = useCallback(
    async (id: string, note: string) => {
      return updateTask(id, { note: note || undefined }, "note");
    },
    [updateTask]
  );

  /** Rattrapage : renseigne le temps réel sans toucher au statut. */
  const setActual = useCallback(
    async (id: string, actualMinutes: number, gapReason?: GapReason, note?: string) => {
      return updateTask(
        id,
        { actualMinutes, actualSource: "rattrapage", gapReason, ...(note ? { note } : {}) },
        "actual"
      );
    },
    [updateTask]
  );

  /** Activité réalisée sans avoir été planifiée : pas de créneau,
   *  seulement une durée. C'est elle qui mesure le hors-plan. */
  const addUnplanned = useCallback(
    async (name: string, minutes: number, goalId?: string, note?: string): Promise<boolean> => {
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
        actualSource: "hors_plan",
        goalId,
        note,
        createdAt: now,
        completedAt: now,
      };
      setTasks((prev) => sortForDay([...prev, task], date));
      try {
        await track(() => repo.tasks.save(task));
        return true;
      } catch (e) {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        reportWrite("unplanned", name, e);
        await refresh();
        return false;
      }
    },
    [date, refresh, reportWrite, track]
  );

  const removeTask = useCallback(
    async (id: string) => {
      const removed = tasksRef.current.find((t) => t.id === id);
      const name = removed?.name ?? "";
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await track(() => repo.tasks.remove(id));
      } catch (e) {
        // Suppression ratée : l'objectif existe toujours, il revient.
        if (removed) setTasks((prev) => sortForDay([...prev.filter((t) => t.id !== id), removed], date));
        reportWrite("remove", name, e);
        await refresh();
      }
    },
    [date, refresh, reportWrite, track]
  );

  const archiveTask = useCallback(
    async (id: string) => {
      return updateTask(id, { archived: true, archivedAt: new Date().toISOString() }, "archive");
    },
    [updateTask]
  );

  // Une séance archivée quitte la journée tout de suite. Auparavant elle
  // restait affichée jusqu'au rechargement : l'archivage ne changeait que
  // son champ archived. Si l'écriture échoue, updateTask rétablit ce
  // champ et elle revient d'elle-même.
  const visible = useMemo(() => tasks.filter((t) => !t.archived), [tasks]);

  return { tasks: visible, ready, loadError, writeFailures, dismissWriteFailure, addTask, updateTask, setStatus, completeTask, setNote, setActual, addUnplanned, removeTask, archiveTask, refresh };
}