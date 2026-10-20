"use client";

import { useRef, useState } from "react";
import type { Task, GapReason } from "@/lib/types";
import { GAP_REASONS } from "@/lib/types";
import { formatDuration, parseDuration } from "@/lib/time";
import DurationInput from "@/components/DurationInput";
import { LIMITS } from "@/lib/limits";

/**
 * Saisie du réalisé, ouverte par « Terminer » / « Fait ».
 *
 * Principe : ce panneau ne s'ajoute PAS au clic de fin, il le remplace.
 * La durée est pré-remplie avec la meilleure estimation disponible, donc
 * valider coûte un tap. Une donnée approximative vaut mieux qu'un champ
 * vide — et de toute façon, sans repère, on ne se souvient de rien le soir.
 *
 * La cause d'écart n'apparaît que si l'écart existe vraiment : la demander
 * quand le temps réel colle à l'estimation serait du bruit.
 *
 * Session rattachée à un parcours : la note fait partie de l'étape.
 * Un champ optionnel posé à côté ne se remplit pas — 7 % de notes,
 * gap_note vide sur 91 objectifs alors que la cause, juste à côté,
 * était cliquée. Ce qui est demandé à la validation l'est à 96 %.
 * Deux boutons qui disent tous deux qu'ils enregistrent le temps :
 * « avec ma note » (exige la note) et « sans note ». Un « Passer »
 * laissait deviner si la séance était enregistrée, et l'hésitant
 * aurait écrit « ok » pour ne pas prendre de risque — faussant la
 * mesure. On demande, on n'oblige pas. Hors parcours, rien ne change.
 */

/**
 * Temps écoulé depuis le clic sur « Démarrer », si ce clic a eu lieu et
 * que le résultat reste plausible.
 *
 * Ce n'est PAS proposé par défaut : un chronomètre lancé puis oublié
 * mesure l'intervalle entre deux clics, pas le travail. Il est offert
 * comme raccourci, clairement étiqueté, à prendre ou à laisser.
 */
export function chronoMinutes(task: Task): number | null {
  if (!task.startedAt) return null;
  const elapsed = Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000);
  if (elapsed <= 0 || elapsed > 16 * 60) return null;
  return elapsed;
}
/** Écart considéré comme normal : en deçà, on ne demande pas de cause. */
const TOLERANCE = 0.15;

export default function ActualTimePanel({
  task,
  goalTitle,
  slotMinutes,
  onConfirm,
  onCancel,
}: {
  task: Task;
  /** Nom du parcours rattaché, s'il y en a un. */
  goalTitle?: string;
  slotMinutes: number;
  onConfirm: (actualMinutes: number, gapReason?: GapReason, note?: string) => void;
  onCancel: () => void;
}) {
  const reference = task.estimatedMinutes ?? slotMinutes;
  // Défaut = ce que tu avais prévu. La question devient "as-tu passé
  // le temps que tu pensais ?", et l'écart se lit tout de suite.
  const [minutes, setMinutes] = useState(formatDuration(reference));
  const [reason, setReason] = useState<GapReason | null>(null);
  // Repliée par défaut : valider une tâche doit rester deux taps.
  // La note est un bonus, jamais un péage.
  const [noteOuverte, setNoteOuverte] = useState(false);
  const [note, setNote] = useState(task.note ?? "");
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const actual = parseDuration(minutes) ?? 0;
  const chrono = chronoMinutes(task);
  const gap = actual - reference;
  const significant = reference > 0 && Math.abs(gap) / reference > TOLERANCE;
  // Rien à retenir d'une session qui n'a pas eu lieu : à zéro minute,
  // la note redevient facultative.
  const askNote = Boolean(task.goalId) && actual > 0;
  const confirm = (withNote: boolean) =>
    onConfirm(
      actual,
      significant ? reason ?? undefined : undefined,
      withNote ? note.trim() || undefined : task.note
    );

  return (
    <div
      style={{
        marginTop: 12,
        padding: "0.9rem 1rem",
        background: "var(--bg-3)",
        borderRadius: 12,
        border: "1px solid var(--border)",
      }}
    >
      <label className="field-label" style={{ display: "block", marginBottom: 6 }}>
        Combien de temps y as-tu réellement passé ?
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <DurationInput
          value={minutes}
          onChange={setMinutes}
          hint={`Tu avais prévu ${formatDuration(reference)}`}
          width={120}
          autoFocus={!askNote}
        />

        {chrono !== null && (
          <button className="chip" onClick={() => setMinutes(formatDuration(chrono))}>
            Chrono : {formatDuration(chrono)}
          </button>
        )}
      </div>

      {significant && (
        <p
          style={{
            fontSize: "0.82rem",
            marginTop: 10,
            color: gap > 0 ? "var(--color-amber-text)" : "var(--color-mint-text)",
          }}
        >
          {gap > 0 ? "+" : "−"}
          {formatDuration(Math.abs(gap))} par rapport au prévu. Qu&apos;est-ce qui explique l&apos;écart ?
        </p>
      )}

      {significant && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {GAP_REASONS.map((r) => (
            <button
              key={r.value}
              className="chip"
              onClick={() => setReason(reason === r.value ? null : r.value)}
              style={
                reason === r.value
                  ? { borderColor: "var(--color-brand)", color: "var(--color-brand)" }
                  : undefined
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {askNote ? (
        <div className="note-step">
          <label className="field-label" htmlFor={`note-${task.id}`} style={{ display: "block" }}>
            Qu&apos;est-ce que tu en retiens ?
          </label>
          {goalTitle && (
            <p style={{ fontSize: "0.76rem", color: "var(--text-mute)", marginBottom: 6 }}>
              Pour ton parcours <span className="goal-tag">{goalTitle}</span>
            </p>
          )}
          <textarea
            ref={noteRef}
            id={`note-${task.id}`}
            className="field"
            rows={3}
            maxLength={LIMITS.note}
            autoFocus
            placeholder="Une notion comprise, un blocage, ce à revoir la prochaine fois…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      ) : noteOuverte ? (
        <div style={{ marginTop: 12 }}>
          <label className="field-label">Ce que tu en retiens</label>
          <textarea
            className="field"
            rows={3}
            maxLength={LIMITS.note}
            placeholder="Ce que j'ai appris, ce qui a bloqué, ce à quoi penser la prochaine fois…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      ) : (
        <button
          className="chip"
          style={{ marginTop: 12 }}
          onClick={() => setNoteOuverte(true)}
        >
          {note ? "Modifier la note" : "+ Ajouter une note"}
        </button>
      )}

      {askNote ? (
        <>
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {/* Jamais désactivé : un bouton grisé sans explication est
                un cul-de-sac. Champ vide -> le curseur y va. */}
            <button
              className="chip chip-mint"
              onClick={() => (note.trim() ? confirm(true) : noteRef.current?.focus())}
            >
              Enregistrer avec ma note
            </button>
            <button className="chip" onClick={() => confirm(false)}>
              Enregistrer sans note
            </button>
            <button className="chip chip-quiet" onClick={onCancel}>
              Annuler
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <button className="chip chip-mint" onClick={() => confirm(true)}>
            Valider
          </button>
          <button className="chip" onClick={onCancel}>
            Annuler
          </button>
        </div>
      )}

      {/* La cause reste facultative : forcer un choix produirait des
          "Autre" en série, ce qui n'apprendrait rien. */}
    </div>
  );
}
