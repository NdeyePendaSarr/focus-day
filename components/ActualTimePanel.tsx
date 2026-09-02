"use client";

import { useState } from "react";
import type { Task, GapReason } from "@/lib/types";
import { GAP_REASONS } from "@/lib/types";
import { formatDuration, parseDuration } from "@/lib/time";
import DurationInput from "@/components/DurationInput";

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
 */

/** Repère par défaut : le temps écoulé depuis le démarrage réel, sinon l'estimation. */
export function suggestActualMinutes(task: Task, fallbackMinutes: number): number {
  if (task.startedAt) {
    const elapsed = Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000);
    // Un chronomètre lancé et oublié pendant deux jours ne prouve rien.
    if (elapsed > 0 && elapsed <= 16 * 60) return elapsed;
  }
  return task.estimatedMinutes ?? fallbackMinutes;
}

/** Écart considéré comme normal : en deçà, on ne demande pas de cause. */
const TOLERANCE = 0.15;

export default function ActualTimePanel({
  task,
  slotMinutes,
  onConfirm,
  onCancel,
}: {
  task: Task;
  slotMinutes: number;
  onConfirm: (actualMinutes: number, gapReason?: GapReason) => void;
  onCancel: () => void;
}) {
  const [minutes, setMinutes] = useState(String(suggestActualMinutes(task, slotMinutes)));
  const [reason, setReason] = useState<GapReason | null>(null);

  const reference = task.estimatedMinutes ?? slotMinutes;
  const actual = parseDuration(minutes) ?? 0;
  const gap = actual - reference;
  const significant = reference > 0 && Math.abs(gap) / reference > TOLERANCE;

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
          autoFocus
        />
      </div>

      {significant && (
        <p
          style={{
            fontSize: "0.82rem",
            marginTop: 10,
            color: gap > 0 ? "var(--color-amber)" : "var(--color-mint)",
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

      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button
          className="chip chip-mint"
          onClick={() => onConfirm(actual, significant ? reason ?? undefined : undefined)}
        >
          Valider
        </button>
        <button className="chip" onClick={onCancel}>
          Annuler
        </button>
      </div>

      {/* La cause reste facultative : forcer un choix produirait des
          "Autre" en série, ce qui n'apprendrait rien. */}
    </div>
  );
}
