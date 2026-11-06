"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Task, Goal } from "@/lib/types";
import { selectableGoals } from "@/lib/goals";
import GoalSelect from "@/components/GoalSelect";
import { toMinutes, findConflict, spillsIntoNextDay, durationMinutes, formatDuration, parseDuration } from "@/lib/time";
import DurationInput from "@/components/DurationInput";
import Dialog from "@/components/Dialog";
import { LIMITS } from "@/lib/limits";
import CharCount from "@/components/CharCount";
import { LONG_SLOT_MINUTES, missingEstimation } from "@/lib/estimation";

export type TaskDraft = {
  name: string;
  description: string;
  why: string;
  start: string;
  end: string;
  estimatedMinutes: string;
  /** "" = aucun parcours. */
  goalId: string;
};

const EMPTY: TaskDraft = { name: "", description: "", why: "", start: "09:00", end: "10:00", estimatedMinutes: "", goalId: "" };

export default function TaskForm({
  open,
  editing,
  existingTasks = [],
  goals = [],
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: Task | null;
  existingTasks?: Task[];
  goals?: Goal[];
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(EMPTY);
  // Tant que l'estimation n'a pas été saisie à la main, elle suit le
  // créneau : allonger un créneau de 1h à 2h doit mettre l'estimation
  // à jour, sinon elle reste fausse sans que rien ne le signale.
  const [estimationTouched, setEstimationTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estimationRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // Un id par champ, pour relier chaque <label> à son champ : sans lui,
  // un lecteur d'écran annonçait « champ texte » sans dire lequel.
  const uid = useId();
  const ids = {
    title: `${uid}-titre`,
    name: `${uid}-nom`,
    start: `${uid}-debut`,
    end: `${uid}-fin`,
    description: `${uid}-description`,
    estimation: `${uid}-estimation`,
    why: `${uid}-pourquoi`,
  };

  useEffect(() => {
    if (editing) {
      // Si l'estimation vaut exactement la durée du créneau, c'est qu'elle
      // n'a jamais été saisie : on la laisse vide pour qu'elle continue
      // de suivre le créneau si celui-ci change.
      const slot = durationMinutes(editing.start, editing.end);
      const explicite = editing.estimatedMinutes != null && editing.estimatedMinutes !== slot;
      setDraft({
        name: editing.name,
        description: editing.description ?? "",
        why: editing.why ?? "",
        start: editing.start,
        end: editing.end,
        estimatedMinutes: explicite ? String(editing.estimatedMinutes) : "",
        goalId: editing.goalId ?? "",
      });
      setEstimationTouched(explicite);
    } else {
      setDraft(EMPTY);
      setEstimationTouched(false);
    }
    setError(null);
  }, [editing, open]);

  if (!open) return null;

  const conflict = findConflict(existingTasks, draft.start, draft.end, editing?.id);
  // Pré-remplissage implicite : laisser le champ vide vaut "la durée du créneau".
  const slotMinutes = durationMinutes(draft.start, draft.end);
  const options = selectableGoals(goals, editing?.goalId);

  const submit = () => {
    if (!draft.name.trim()) return setError("Donne un nom à ton objectif.");
    if (toMinutes(draft.end) === toMinutes(draft.start))
      return setError("Le créneau ne peut pas durer 0 minute.");
    // Estimation saisie mais refusée : sans ce contrôle, elle retombait
    // en silence sur la durée du créneau (ou, pour « 0 », échouait en
    // base, qui exige une estimation positive).
    if (draft.estimatedMinutes.trim() !== "") {
      const estimation = parseDuration(draft.estimatedMinutes);
      if (estimation === null || estimation === 0) {
        estimationRef.current?.focus();
        return setError(
          estimation === 0
            ? "L'estimation doit être d'au moins une minute — ou laisse le champ vide."
            : "L'estimation n'est pas valable : corrige-la ou laisse le champ vide."
        );
      }
    }
    // Long créneau : l'estimation ne se déduit plus, elle se demande.
    const manque = missingEstimation(slotMinutes, draft.estimatedMinutes);
    if (manque) {
      estimationRef.current?.focus();
      return setError(manque);
    }
    onSubmit(draft);
  };

  const set = (k: keyof TaskDraft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    // Échap, focus gardé dans la fenêtre et rendu à la fermeture : Dialog.
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={ids.title}
      initialFocus={nameRef}
      overlayStyle={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 50,
      }}
      className="card-surface"
      style={{
        width: "100%",
        maxWidth: 460,
        padding: "1.25rem",
        /* Le formulaire ne doit jamais dépasser la fenêtre : sur un
           téléphone en paysage ou un petit écran, il défile dedans
           au lieu de sortir du cadre. */
        maxHeight: "90vh",
        overflowY: "auto",
        animation: "var(--animate-slide-up)",
      }}
    >
      <h2 id={ids.title} style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.9rem" }}>
        {editing ? "Modifier l'objectif" : "Nouvel objectif"}
      </h2>

      <div style={{ display: "grid", gap: "0.8rem" }}>
        <div>
          <label className="field-label" htmlFor={ids.name}>Nom de l&apos;objectif</label>
          <input
            ref={nameRef}
            id={ids.name}
            className="field"
            autoFocus
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={LIMITS.taskTitle}
            placeholder="Réviser le chapitre 3"
          />
          <CharCount value={draft.name} max={LIMITS.taskTitle} />
        </div>

        <div className="time-row">
          <div>
            <label className="field-label" htmlFor={ids.start}>Début</label>
            <input id={ids.start} type="time" className="field" value={draft.start} onChange={(e) => set("start", e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor={ids.end}>Fin</label>
            <input id={ids.end} type="time" className="field" value={draft.end} onChange={(e) => set("end", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor={ids.description}>Description (optionnel)</label>
          <input
            id={ids.description}
            className="field"
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={LIMITS.description}
            placeholder="Exercices 1 à 10"
          />
          <CharCount value={draft.description} max={LIMITS.description} />
        </div>

        <div>
          <label className="field-label" htmlFor={ids.estimation}>
            Combien de temps penses-tu y passer vraiment ?
          </label>
          <DurationInput
            value={draft.estimatedMinutes}
            onChange={(v) => {
              setEstimationTouched(true);
              set("estimatedMinutes", v);
            }}
            placeholder={slotMinutes > LONG_SLOT_MINUTES ? "Temps de travail" : formatDuration(slotMinutes)}
            hint={
              slotMinutes > LONG_SLOT_MINUTES
                ? `Créneau de ${formatDuration(slotMinutes)} : indique le temps de travail réel prévu`
                : `Vide = la durée du créneau (${formatDuration(slotMinutes)})`
            }
            inputRef={estimationRef}
            id={ids.estimation}
            width={130}
          />
        </div>

        {/* Optionnel : tout ne relève pas d'une formation. Sans parcours
            créé, le champ cède la place à une indication. */}
        <div>
          <label className="field-label" htmlFor="task-goal">Parcours (optionnel)</label>
          {options.length > 0 ? (
            <GoalSelect
              id="task-goal"
              goals={goals}
              value={draft.goalId}
              currentId={editing?.goalId}
              onChange={(v) => set("goalId", v)}
            />
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--text-mute)" }}>
              Aucun parcours en cours. Crée-en un dans l&apos;onglet Parcours pour y rattacher tes objectifs.
            </p>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor={ids.why}>Pourquoi c&apos;est important ?</label>
          <textarea
            id={ids.why}
            className="field"
            rows={2}
            value={draft.why}
            onChange={(e) => set("why", e.target.value)}
            maxLength={LIMITS.why}
            placeholder="Pour être prête à l'examen sans stresser."
            style={{ resize: "vertical" }}
          />
          <CharCount value={draft.why} max={LIMITS.why} />
        </div>


        {/* Annoncée dès qu'elle apparaît : le focus, lui, est souvent
            ramené dans le champ fautif. */}
        {error && (
          <p role="alert" style={{ color: "var(--color-rose-text)", fontSize: "0.85rem" }}>{error}</p>
        )}
        {!error && spillsIntoNextDay(draft.start, draft.end) && (
          <p style={{ color: "var(--color-brand)", fontSize: "0.82rem" }}>
            🌙 Ce créneau traverse minuit — il se terminera le lendemain à {draft.end}.
          </p>
        )}
        {!error && conflict && (
          <p style={{ color: "var(--color-amber-text)", fontSize: "0.82rem" }}>
            ⚠ Ce créneau chevauche « {conflict.name} » ({conflict.start}–{conflict.end}). Tu peux quand même l&apos;ajouter.
          </p>
        )}

        <div style={{ display: "flex", gap: "0.7rem", justifyContent: "flex-end", marginTop: "0.3rem" }}>
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={submit}>
            {editing ? "Enregistrer" : "Ajouter à ma journée"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
