"use client";

import { useState } from "react";
import type { Task, GapReason } from "@/lib/types";
import { GAP_REASONS } from "@/lib/types";
import { formatDuration, durationMinutes } from "@/lib/time";

/**
 * Rattrapage du soir.
 *
 * Deux manques que la saisie en cours de journée ne couvre pas :
 *
 *  1. Les tâches dont on n'a jamais renseigné le temps réel — y compris
 *     celles qui n'ont pas été faites. Un zéro est une donnée, pas un vide.
 *
 *  2. Ce qu'on a fait sans l'avoir prévu. C'est la mesure que les outils
 *     de suivi ne donnent pas : la part de journée qui échappe au plan.
 */
export default function DayCatchUp({
  tasks,
  onSetActual,
  onAddUnplanned,
}: {
  tasks: Task[];
  onSetActual: (id: string, actualMinutes: number, gapReason?: GapReason) => void;
  onAddUnplanned: (name: string, minutes: number) => void;
}) {
  // Uniquement les créneaux planifiés sans temps réel renseigné.
  const missing = tasks.filter((t) => t.origin !== "unplanned" && t.actualMinutes == null);
  const unplanned = tasks.filter((t) => t.origin === "unplanned");

  return (
    <div style={{ display: "grid", gap: "1.4rem" }}>
      {missing.length > 0 && (
        <div>
          <label className="field-label" style={{ display: "block", marginBottom: 8 }}>
            Il manque le temps réel de {missing.length}{" "}
            {missing.length > 1 ? "objectifs" : "objectif"}
          </label>
          <div style={{ display: "grid", gap: 8 }}>
            {missing.map((t) => (
              <MissingRow key={t.id} task={t} onSetActual={onSetActual} />
            ))}
          </div>
        </div>
      )}

      <UnplannedBlock existing={unplanned} onAdd={onAddUnplanned} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MissingRow({
  task,
  onSetActual,
}: {
  task: Task;
  onSetActual: (id: string, actualMinutes: number, gapReason?: GapReason) => void;
}) {
  const reference = task.estimatedMinutes ?? durationMinutes(task.start, task.end);
  const [minutes, setMinutes] = useState("");
  const [reason, setReason] = useState<GapReason | null>(null);

  const actual = minutes === "" ? null : Number(minutes);
  const gap = actual === null ? 0 : actual - reference;
  const significant = actual !== null && reference > 0 && Math.abs(gap) / reference > 0.15;

  return (
    <div
      style={{
        padding: "0.75rem 0.9rem",
        background: "var(--bg-3)",
        borderRadius: 10,
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 6 }}>{task.name}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input
          type="number"
          min={0}
          step={5}
          className="field"
          style={{ width: 90 }}
          placeholder="min"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <span style={{ fontSize: "0.78rem", color: "var(--text-mute)" }}>
          prévu {formatDuration(reference)}
        </span>
        {/* Le zéro mérite son propre bouton : sans lui, une journée ratée
            ne laisse aucune trace, et c'est justement celle qui informe. */}
        <button className="chip" onClick={() => setMinutes("0")}>
          Pas fait
        </button>
        <button
          className="chip chip-mint"
          disabled={actual === null}
          onClick={() => onSetActual(task.id, actual ?? 0, reason ?? undefined)}
        >
          Valider
        </button>
      </div>

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
    </div>
  );
}

/* ------------------------------------------------------------------ */

function UnplannedBlock({
  existing,
  onAdd,
}: {
  existing: Task[];
  onAdd: (name: string, minutes: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");

  const total = existing.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0);

  const m = Number(minutes);
  // Le bouton est désactivé plutôt que silencieux : un clic sans effet
  // fait croire à un bug, alors qu'il manque simplement une durée.
  const canAdd = name.trim().length > 0 && m > 0;

  const add = () => {
    if (!canAdd) return;
    onAdd(name.trim(), m);
    setName("");
    setMinutes("");
    setOpen(false);
  };

  return (
    <div>
      <label className="field-label" style={{ display: "block", marginBottom: 8 }}>
        As-tu fait autre chose, qui n&apos;était pas au programme ?
      </label>

      {existing.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {existing.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.85rem",
                padding: "0.4rem 0.7rem",
                background: "var(--bg-3)",
                borderRadius: 8,
              }}
            >
              <span>{t.name}</span>
              <span style={{ color: "var(--color-amber)", fontWeight: 600 }}>
                {formatDuration(t.actualMinutes ?? 0)}
              </span>
            </div>
          ))}
          <p style={{ fontSize: "0.78rem", color: "var(--text-mute)" }}>
            {formatDuration(total)} hors plan aujourd&apos;hui.
          </p>
        </div>
      )}

      {!open ? (
        <button className="chip" onClick={() => setOpen(true)}>
          + J&apos;ai fait autre chose
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="field"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Quoi ?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            type="number"
            min={1}
            step={5}
            className="field"
            style={{ width: 90 }}
            placeholder="min"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <button className="chip chip-mint" onClick={add} disabled={!canAdd}>
            Ajouter
          </button>
          <button className="chip" onClick={() => setOpen(false)}>
            Annuler
          </button>
          {!canAdd && (
            <span style={{ fontSize: "0.78rem", color: "var(--text-mute)", width: "100%" }}>
              Indique aussi combien de temps ça t&apos;a pris.
            </span>
          )}
        </div>
      )}
    </div>
  );
}