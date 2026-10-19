"use client";

import { useRef, useState } from "react";
import type { Task, GapReason, Goal } from "@/lib/types";
import { GAP_REASONS } from "@/lib/types";
import { formatDuration, durationMinutes, parseDuration } from "@/lib/time";
import DurationInput from "@/components/DurationInput";
import GoalSelect from "@/components/GoalSelect";

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
 *     Pour un apprenant, c'est souvent le cours suivi sur un coup de
 *     tête : il se rattache à un parcours comme un objectif planifié,
 *     sinon le portfolio sous-compterait l'apprentissage spontané.
 */
export default function DayCatchUp({
  tasks,
  goals,
  onSetActual,
  onAddUnplanned,
}: {
  tasks: Task[];
  goals: Goal[];
  onSetActual: (id: string, actualMinutes: number, gapReason?: GapReason, note?: string) => void;
  onAddUnplanned: (name: string, minutes: number, goalId?: string, note?: string) => void;
}) {
  const goalTitle = (id?: string) => (id ? goals.find((g) => g.id === id)?.title : undefined);
  // Uniquement les créneaux planifiés sans temps réel renseigné.
  const missing = tasks.filter((t) => t.origin !== "unplanned" && t.actualMinutes == null);
  const unplanned = tasks.filter((t) => t.origin === "unplanned");
  const planned = tasks.filter((t) => t.origin !== "unplanned");

  const prevu = planned.reduce(
    (sum, t) => sum + (t.estimatedMinutes ?? durationMinutes(t.start, t.end)),
    0
  );
  const reel = planned.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0);
  const horsPlan = unplanned.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0);

  return (
    <div style={{ display: "grid", gap: "1.4rem" }}>
      <DayRecap prevu={prevu} reel={reel} horsPlan={horsPlan} />
      {missing.length > 0 && (
        <div>
          <label className="field-label" style={{ display: "block", marginBottom: 8 }}>
            Il manque le temps réel de {missing.length}{" "}
            {missing.length > 1 ? "objectifs" : "objectif"}
          </label>
          <div style={{ display: "grid", gap: 8 }}>
            {missing.map((t) => (
              <MissingRow key={t.id} task={t} goalTitle={goalTitle(t.goalId)} onSetActual={onSetActual} />
            ))}
          </div>
        </div>
      )}

      <UnplannedBlock existing={unplanned} goals={goals} onAdd={onAddUnplanned} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Séance rattachée à un parcours : la question de la note est dépliée,
 * mais rien n'est exigé pour valider. Le rattrapage traite plusieurs
 * séances d'un coup et est rempli à 96 % ; des champs obligatoires le
 * rendraient pénible. C'est aussi une variante à comparer avec le
 * panneau de validation, qui lui demande de choisir avec ou sans note.
 */
function MissingRow({
  task,
  goalTitle,
  onSetActual,
}: {
  task: Task;
  goalTitle?: string;
  onSetActual: (id: string, actualMinutes: number, gapReason?: GapReason, note?: string) => void;
}) {
  const reference = task.estimatedMinutes ?? durationMinutes(task.start, task.end);
  const [minutes, setMinutes] = useState("");
  const [reason, setReason] = useState<GapReason | null>(null);
  const [note, setNote] = useState(task.note ?? "");

  const actual = minutes.trim() === "" ? null : parseDuration(minutes);
  const gap = actual === null ? 0 : actual - reference;
  const significant = actual !== null && reference > 0 && Math.abs(gap) / reference > 0.15;
  // Pas de question pour une séance marquée « Pas fait ».
  const askNote = Boolean(task.goalId) && actual !== 0;

  return (
    <div
      style={{
        padding: "0.75rem 0.9rem",
        background: "var(--bg-3)",
        borderRadius: 10,
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {task.name}
        {goalTitle && <span className="goal-tag">{goalTitle}</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <DurationInput
          value={minutes}
          onChange={setMinutes}
          hint={`Prévu ${formatDuration(reference)}`}
          width={110}
        />
        {/* Le zéro mérite son propre bouton : sans lui, une journée ratée
            ne laisse aucune trace, et c'est justement celle qui informe. */}
        <button className="chip" onClick={() => setMinutes("0")}>
          Pas fait
        </button>
        <button
          className="chip chip-mint"
          disabled={actual === null}
          onClick={() =>
            onSetActual(task.id, actual ?? 0, reason ?? undefined, askNote ? note.trim() || undefined : undefined)
          }
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

      {askNote && (
        <div style={{ marginTop: 10 }}>
          <label className="field-label" htmlFor={`catchup-note-${task.id}`}>
            Qu&apos;est-ce que tu en retiens ?
          </label>
          <textarea
            id={`catchup-note-${task.id}`}
            className="field"
            rows={2}
            maxLength={5000}
            placeholder="Une notion comprise, un blocage, ce à revoir…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function UnplannedBlock({
  existing,
  goals,
  onAdd,
}: {
  existing: Task[];
  goals: Goal[];
  onAdd: (name: string, minutes: number, goalId?: string, note?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [goalId, setGoalId] = useState("");
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const goalTitle = (id?: string) => (id ? goals.find((g) => g.id === id)?.title : undefined);

  const total = existing.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0);

  const m = parseDuration(minutes) ?? 0;
  // Le bouton est désactivé plutôt que silencieux : un clic sans effet
  // fait croire à un bug, alors qu'il manque simplement une durée.
  const canAdd = name.trim().length > 0 && m > 0;

  // Hors-plan rattaché à un parcours : même paire de boutons que le
  // panneau de validation d'une séance.
  const askNote = goalId !== "";

  const add = (withNote: boolean) => {
    if (!canAdd) return;
    onAdd(name.trim(), m, goalId || undefined, withNote ? note.trim() || undefined : undefined);
    setName("");
    setMinutes("");
    setGoalId("");
    setNote("");
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
              <span style={{ minWidth: 0, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {t.name}
                {goalTitle(t.goalId) && <span className="goal-tag">{goalTitle(t.goalId)}</span>}
              </span>
              <span style={{ color: "var(--color-amber-text)", fontWeight: 600 }}>
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
          <DurationInput value={minutes} onChange={setMinutes} width={110} />
          <GoalSelect goals={goals} value={goalId} onChange={setGoalId} style={{ flex: "0 1 220px", minWidth: 0 }} />
          {askNote ? (
            <>
              <div className="note-step" style={{ width: "100%", marginTop: 4 }}>
                <label className="field-label" htmlFor="unplanned-note">
                  Qu&apos;est-ce que tu en retiens ?
                </label>
                <textarea
                  ref={noteRef}
                  id="unplanned-note"
                  className="field"
                  rows={3}
                  maxLength={5000}
                  placeholder="Une notion comprise, un blocage, ce à revoir la prochaine fois…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>
              {/* Désactivé seulement faute de nom ou de durée (la phrase
                  ci-dessous le dit) ; note vide -> le curseur y va. */}
              <button
                className="chip chip-mint"
                onClick={() => (note.trim() ? add(true) : noteRef.current?.focus())}
                disabled={!canAdd}
              >
                Enregistrer avec ma note
              </button>
              <button className="chip" onClick={() => add(false)} disabled={!canAdd}>
                Enregistrer sans note
              </button>
            </>
          ) : (
            <button className="chip chip-mint" onClick={() => add(false)} disabled={!canAdd}>
              Ajouter
            </button>
          )}
          <button className="chip chip-quiet" onClick={() => setOpen(false)}>
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

/* ------------------------------------------------------------------ */

/**
 * Le rapport prévu / réalisé de la journée, en une barre.
 *
 * La barre grise porte le temps prévu, la barre pleine ce qui a
 * réellement été fait. L'écart se lit sans avoir à comparer deux
 * nombres — c'est la seule chose que cette carte doit rendre évidente.
 */
function DayRecap({ prevu, reel, horsPlan }: { prevu: number; reel: number; horsPlan: number }) {
  if (prevu === 0 && reel === 0 && horsPlan === 0) return null;

  const echelle = Math.max(prevu, reel + horsPlan, 1);
  const w = (m: number) => `${(m / echelle) * 100}%`;

  return (
    <div>
      <label className="field-label" style={{ display: "block", marginBottom: 10 }}>
        Ta journée en temps
      </label>

      <div style={{ display: "grid", gap: 10 }}>
        <Bar
          label="Prévu"
          value={formatDuration(prevu)}
          segments={[{ width: w(prevu), color: "var(--text-mute)", opacity: 0.45 }]}
        />
        <Bar
          label="Réalisé"
          value={formatDuration(reel + horsPlan)}
          segments={[
            { width: w(reel), color: "var(--color-mint)", opacity: 0.9 },
            { width: w(horsPlan), color: "var(--color-amber)", opacity: 0.9 },
          ]}
        />
      </div>

      {horsPlan > 0 && (
        <p style={{ fontSize: "0.76rem", color: "var(--text-mute)", marginTop: 8 }}>
          Dont {formatDuration(horsPlan)} hors plan.
        </p>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  segments,
}: {
  label: string;
  value: string;
  segments: { width: string; color: string; opacity: number }[];
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: "0.76rem", color: "var(--text-mute)", width: 56, flexShrink: 0 }}>
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 10,
          borderRadius: 999,
          background: "var(--bg-3)",
          display: "flex",
          overflow: "hidden",
        }}
      >
        {segments.map((seg, i) => (
          <div key={i} style={{ width: seg.width, background: seg.color, opacity: seg.opacity }} />
        ))}
      </div>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, width: 60, textAlign: "right", flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}
