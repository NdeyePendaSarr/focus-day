"use client";

import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { toMinutes, endMinutesAdjusted, formatDuration } from "@/lib/time";
import { dayRange, rangePct } from "@/lib/dayRange";

const STATUS_FILL: Record<string, string> = {
  planned: "var(--text-mute)",
  in_progress: "var(--color-amber)",
  done: "var(--color-mint)",
  missed: "var(--color-rose)",
};

/**
 * La journée en une ligne : ce qui est fait, ce qui reste, et le ruban
 * des créneaux avec le repère « maintenant ».
 *
 * Remplace le rail de gauche (deux gros chiffres et une frise verticale
 * de toute la hauteur) : la même information tient en une bande, et les
 * séances prennent toute la largeur.
 */
export default function DaySummary({
  tasks,
  now,
  done,
  minutesPrevues,
  minutesRealisees,
}: {
  /** Séances prévues de la journée (hors activités hors plan). */
  tasks: Task[];
  now: number;
  done: number;
  minutesPrevues: number;
  minutesRealisees: number;
}) {
  const slotted = useMemo(() => tasks.filter((t) => t.start && t.end), [tasks]);
  const range = useMemo(() => dayRange(slotted, now), [slotted, now]);
  const nowVisible = now >= range.start && now <= range.end;
  const n = tasks.length;

  return (
    <section className="day-summary card-surface">
      <div className="day-summary-facts">
        <p>
          <strong>{n}</strong> {n < 2 ? "séance" : "séances"}
          <span className="day-summary-sep" aria-hidden="true">·</span>
          <strong className="day-summary-done">{done}</strong> {done < 2 ? "terminée" : "terminées"}
        </p>
        {minutesPrevues > 0 && (
          <p className="day-summary-time">
            <strong className="day-summary-done">{formatDuration(minutesRealisees)}</strong>
            {` réalisées sur ${formatDuration(minutesPrevues)} prévues`}
          </p>
        )}
      </div>

      {slotted.length > 0 && (
        <div className="day-ribbon">
          <div
            className="day-ribbon-track"
            role="img"
            aria-label={`Créneaux du jour, de ${range.start / 60} h à ${range.end / 60} h`}
          >
            {slotted.map((t) => {
              const a = rangePct(range, toMinutes(t.start));
              const b = rangePct(range, endMinutesAdjusted(t.start, t.end));
              return (
                <span
                  key={t.id}
                  className="day-ribbon-slot"
                  title={`${t.start}–${t.end} · ${t.name}`}
                  style={{ left: `${a}%`, width: `${Math.max(b - a, 0.8)}%`, background: STATUS_FILL[t.status] }}
                />
              );
            })}
            {nowVisible && (
              <span className="day-ribbon-now" style={{ left: `${rangePct(range, now)}%` }}>
                <span className="day-ribbon-now-label">maintenant</span>
              </span>
            )}
          </div>
          <div className="day-ribbon-hours" aria-hidden="true">
            {range.hours.map((h) => (
              <span key={h} style={{ left: `${rangePct(range, h * 60)}%` }}>
                {String(h).padStart(2, "0")} h
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
