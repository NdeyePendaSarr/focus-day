"use client";

import { useState } from "react";
import type { Task, TaskStatus, GapReason } from "@/lib/types";
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
  onComplete: (id: string, actualMinutes: number, gapReason?: GapReason) => void;
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ minWidth: 0 }}>
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
            {task.actualMinutes != null && (
              <span style={{ fontSize: "0.72rem", color: "var(--color-mint)", fontWeight: 600 }}>
                réel {formatDuration(task.actualMinutes)}
              </span>
            )}
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
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
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
          onConfirm={(m, r) => {
            setCapturing(false);
            onComplete(task.id, m, r);
          }}
          onCancel={() => setCapturing(false)}
        />
      )}
    </article>
  );
}
