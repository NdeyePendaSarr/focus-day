"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { toMinutes, findConflict, spillsIntoNextDay, durationMinutes, formatDuration } from "@/lib/time";

export type TaskDraft = {
  name: string;
  description: string;
  why: string;
  start: string;
  end: string;
  estimatedMinutes: string;
};

const EMPTY: TaskDraft = { name: "", description: "", why: "", start: "09:00", end: "10:00", estimatedMinutes: "" };

export default function TaskForm({
  open,
  editing,
  existingTasks = [],
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: Task | null;
  existingTasks?: Task[];
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft({
        name: editing.name,
        description: editing.description ?? "",
        why: editing.why ?? "",
        start: editing.start,
        end: editing.end,
        estimatedMinutes: editing.estimatedMinutes ? String(editing.estimatedMinutes) : "",
      });
    } else {
      setDraft(EMPTY);
    }
    setError(null);
  }, [editing, open]);

  // Fermeture au clavier (Échap) — accessibilité
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const conflict = findConflict(existingTasks, draft.start, draft.end, editing?.id);
  // Pré-remplissage implicite : laisser le champ vide vaut "la durée du créneau".
  const slotMinutes = durationMinutes(draft.start, draft.end);

  const submit = () => {
    if (!draft.name.trim()) return setError("Donne un nom à ton objectif.");
    if (toMinutes(draft.end) === toMinutes(draft.start))
      return setError("Le créneau ne peut pas durer 0 minute.");
    onSubmit(draft);
  };

  const set = (k: keyof TaskDraft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div
      onClick={onClose}
      style={{
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
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Modifier l\'objectif" : "Nouvel objectif"}
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
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.9rem" }}>
          {editing ? "Modifier l'objectif" : "Nouvel objectif"}
        </h2>

        <div style={{ display: "grid", gap: "0.8rem" }}>
          <div>
            <label className="field-label">Nom de l&apos;objectif</label>
            <input
              className="field"
              autoFocus
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Réviser le chapitre 3"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "0.8rem" }}>
            <div>
              <label className="field-label">Début</label>
              <input type="time" className="field" value={draft.start} onChange={(e) => set("start", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Fin</label>
              <input type="time" className="field" value={draft.end} onChange={(e) => set("end", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="field-label">Description (optionnel)</label>
            <input
              className="field"
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Exercices 1 à 10"
            />
          </div>

          <div>
            <label className="field-label">
              Combien de temps penses-tu y passer vraiment ?
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input
                type="number"
                min={1}
                step={5}
                className="field"
                style={{ width: 90 }}
                placeholder={String(slotMinutes)}
                value={draft.estimatedMinutes}
                onChange={(e) => set("estimatedMinutes", e.target.value)}
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-mute)" }}>
                minutes — créneau : {formatDuration(slotMinutes)}
              </span>
            </div>
          </div>

          <div>
            <label className="field-label">Pourquoi c&apos;est important ?</label>
            <textarea
              className="field"
              rows={2}
              value={draft.why}
              onChange={(e) => set("why", e.target.value)}
              placeholder="Pour être prête à l'examen sans stresser."
              style={{ resize: "vertical" }}
            />
          </div>

          {error && (
            <p style={{ color: "var(--color-rose)", fontSize: "0.85rem" }}>{error}</p>
          )}
          {!error && spillsIntoNextDay(draft.start, draft.end) && (
            <p style={{ color: "var(--color-brand)", fontSize: "0.82rem" }}>
              🌙 Ce créneau traverse minuit — il se terminera le lendemain à {draft.end}.
            </p>
          )}
          {!error && conflict && (
            <p style={{ color: "var(--color-amber)", fontSize: "0.82rem" }}>
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
      </div>
    </div>
  );
}