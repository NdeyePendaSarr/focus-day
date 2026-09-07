"use client";

import { useState } from "react";
import type { Task, TaskStatus, GapReason } from "@/lib/types";
import { GAP_REASONS } from "@/lib/types";
import ActualTimePanel from "@/components/ActualTimePanel";
import { formatDuration, durationMinutes, timePosition, spillsIntoNextDay } from "@/lib/time";

const STATUS_LABEL: Record<TaskStatus, string> = {
  planned: "À faire",
  in_progress: "En cours",
  done: "Terminée",
  missed: "Manquée",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  planned: "var(--text-soft)",
  in_progress: "var(--color-amber)",
  done: "var(--color-mint)",
  missed: "var(--color-rose)",
};

export default function TaskCard({
  task,
  now,
  onStatus,
  onComplete,
  onEdit,
  onArchive,
}: {
  task: Task;
  now: number;
  onStatus: (id: string, s: TaskStatus) => void;
  /** Termine la tâche ET enregistre le réalisé, en une seule opération. */
  onComplete: (id: string, actualMinutes: number, gapReason?: GapReason, note?: string) => void;
  onEdit: (task: Task) => void;
  onArchive: (id: string) => void;
}) {
  const [capturing, setCapturing] = useState(false);
  const pos = timePosition(task, now);
  const duration = durationMinutes(task.start, task.end);
  const overnight = spillsIntoNextDay(task.start, task.end);
  const isCurrent = pos === "current" && task.status !== "done";

  return (
    <article
      className="task-card"
      style={{
        background: "var(--bg-2)",
        border: `1px solid ${isCurrent ? "var(--color-amber)" : "var(--border)"}`,
        borderRadius: 16,
        padding: "1rem 1.15rem",
        boxShadow: isCurrent ? "0 0 0 3px color-mix(in srgb, var(--color-amber) 15%, transparent)" : "var(--shadow)",
        transition: "border-color .3s, box-shadow .3s",
      }}
    >
      <div className="task-head">
        {/* flex "1 1 260px" : le titre se comprime et revient à la ligne
            au lieu de repousser le bloc de droite sous la carte.
            Sans base explicite, un titre long l'emporte sur la mise en page. */}
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-brand)",
              }}
            >
              {task.start}–{task.end}
            </span>
            {overnight && (
              <span
                title="Se termine le lendemain"
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: "var(--color-brand)",
                  background: "var(--bg-3)",
                  padding: "1px 5px",
                  borderRadius: 999,
                }}
              >
                +1j
              </span>
            )}
            <span style={{ fontSize: "0.72rem", color: "var(--text-mute)" }}>
              {formatDuration(duration)}
            </span>

          </div>
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.1rem",
              fontWeight: 600,
              textDecoration: task.status === "done" ? "line-through" : "none",
              opacity: task.status === "done" ? 0.6 : 1,
            }}
          >
            {task.name}
          </h3>
          {task.description && (
            <p style={{ fontSize: "0.88rem", color: "var(--text-soft)", marginTop: 2 }}>
              {task.description}
            </p>
          )}
          {task.why && (
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--text-soft)",
                marginTop: 6,
                paddingLeft: 10,
                borderLeft: "2px solid var(--color-amber)",
                fontStyle: "italic",
              }}
            >
              {task.why}
            </p>
          )}

        {task.note && (
          <p
            style={{
              marginTop: 8,
              padding: "0.5rem 0.7rem",
              background: "var(--bg-3)",
              borderRadius: 8,
              fontSize: "0.85rem",
              color: "var(--text-soft)",
              whiteSpace: "pre-wrap",
            }}
          >
            {task.note}
          </p>
        )}
        </div>

        <div className="task-side">
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              color: STATUS_COLOR[task.status],
              whiteSpace: "nowrap",
            }}
          >
            ● {STATUS_LABEL[task.status]}
          </span>

          <TaskGap task={task} slotMinutes={duration} />
        </div>
      </div>

      {/* Actions de statut */}
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {task.status !== "in_progress" && task.status !== "done" && (
          <button className="chip" onClick={() => onStatus(task.id, "in_progress")}>
            Démarrer
          </button>
        )}
        {task.status === "in_progress" && (
          <button className="chip chip-mint" onClick={() => setCapturing(true)}>
            Terminer
          </button>
        )}
        {task.status !== "done" && task.status !== "in_progress" && (
          <button className="chip chip-mint" onClick={() => setCapturing(true)}>
            Fait
          </button>
        )}
        {task.status === "done" && (
          <button className="chip" onClick={() => onStatus(task.id, "planned")}>
            Rouvrir
          </button>
        )}
        <button className="chip" onClick={() => onEdit(task)}>
          Modifier
        </button>
        <button className="chip" onClick={() => onArchive(task.id)}>
          Archiver
        </button>
      </div>

      {capturing && (
        <ActualTimePanel
          task={task}
          slotMinutes={duration}
          onConfirm={(m, r, n) => {
            setCapturing(false);
            onComplete(task.id, m, r, n);
          }}
          onCancel={() => setCapturing(false)}
        />
      )}
    </article>
  );
}

/**
 * Le rapport prévu / réel de la tâche.
 *
 * C'est l'information centrale du produit : elle occupe la place que
 * les boutons laissaient vide, au lieu d'être écrite en gris clair à
 * côté de l'heure. La référence est l'effort estimé, pas la durée du
 * créneau — bloquer deux heures n'est pas estimer deux heures de travail.
 */
function TaskGap({ task, slotMinutes }: { task: Task; slotMinutes: number }) {
  const reference = task.estimatedMinutes ?? slotMinutes;

  if (task.actualMinutes == null) {
    return (
      <span style={{ fontSize: "0.72rem", color: "var(--text-mute)", whiteSpace: "nowrap" }}>
        {formatDuration(reference)} estimées
      </span>
    );
  }

  const actual = task.actualMinutes;
  const gap = actual - reference;
  const echelle = Math.max(reference, actual, 1);
  const w = (m: number) => `${(m / echelle) * 100}%`;

  const reason = GAP_REASONS.find((r) => r.value === task.gapReason);

  return (
    <div style={{ width: 190, display: "grid", gap: 5 }}>
      <MiniBar label="Prévu" width={w(reference)} color="var(--text-mute)" opacity={0.45} value={formatDuration(reference)} />
      <MiniBar label="Réel" width={w(actual)} color="var(--color-mint)" opacity={0.9} value={formatDuration(actual)} />

      {gap !== 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 1 }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-mute)" }}>{reason?.label ?? ""}</span>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              color: gap > 0 ? "var(--color-amber)" : "var(--text-soft)",
              whiteSpace: "nowrap",
            }}
          >
            {gap > 0 ? "+" : "\u2212"}
            {formatDuration(Math.abs(gap))}
          </span>
        </div>
      )}
    </div>
  );
}

function MiniBar({
  label,
  width,
  color,
  opacity,
  value,
}: {
  label: string;
  width: string;
  color: string;
  opacity: number;
  value: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: "0.68rem", color: "var(--text-mute)", width: 34, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--bg-3)", overflow: "hidden" }}>
        <div style={{ width, height: "100%", background: color, opacity }} />
      </div>
      <span style={{ fontSize: "0.68rem", color: "var(--text-soft)", width: 46, textAlign: "right", flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}
