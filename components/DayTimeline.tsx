"use client";

import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { toMinutes, endMinutesAdjusted } from "@/lib/time";

/**
 * La journée comme un ruban de temps.
 *
 * Le ruban ne couvre plus une plage fixe 05h-minuit : il se cale sur les
 * créneaux réels, avec une heure de marge de chaque côté. Une journée de
 * deux tâches entre 11h et 15h n'affiche plus six heures de vide au-dessus.
 */

const STATUS_DOT: Record<string, string> = {
  planned: "var(--text-mute)",
  in_progress: "var(--color-amber)",
  done: "var(--color-mint)",
  missed: "var(--color-rose)",
};

/** Amplitude minimale, pour qu'une journée d'une seule tâche reste lisible. */
const MIN_SPAN = 4 * 60;

export default function DayTimeline({ tasks, now }: { tasks: Task[]; now: number }) {
  // Les activités hors plan n'ont pas de créneau : elles ne sont pas placées ici.
  const slotted = useMemo(() => tasks.filter((t) => t.start && t.end), [tasks]);

  const { start, end, hours } = useMemo(() => {
    if (slotted.length === 0) {
      return { start: 8 * 60, end: 20 * 60, hours: [8, 11, 14, 17, 20] };
    }

    const starts = slotted.map((t) => toMinutes(t.start));
    const ends = slotted.map((t) => endMinutesAdjusted(t.start, t.end));

    // Le curseur "maintenant" doit rester dans le cadre.
    let lo = Math.min(...starts, now) - 60;
    let hi = Math.max(...ends, now) + 60;

    lo = Math.max(0, Math.floor(lo / 60) * 60);
    hi = Math.min(24 * 60, Math.ceil(hi / 60) * 60);

    if (hi - lo < MIN_SPAN) {
      hi = Math.min(24 * 60, lo + MIN_SPAN);
      lo = Math.max(0, hi - MIN_SPAN);
    }

    // Une graduation toutes les 1, 2 ou 3 heures selon l'amplitude :
    // au-delà, les heures se chevauchent dans une colonne étroite.
    const span = hi - lo;
    const step = span > 8 * 60 ? 3 : span > 5 * 60 ? 2 : 1;
    const ticks: number[] = [];
    for (let h = Math.ceil(lo / 60); h * 60 <= hi; h += step) ticks.push(h);

    return { start: lo, end: hi, hours: ticks };
  }, [slotted, now]);

  const range = end - start;
  const pct = (min: number) => Math.max(0, Math.min(100, ((min - start) / range) * 100));

  // Hauteur proportionnelle à la durée couverte : une journée courte
  // n'occupe pas la même place qu'une journée de douze heures.
  const height = Math.round(Math.min(300, Math.max(180, (range / 60) * 26)));
  const nowVisible = now >= start && now <= end;

  return (
    <div style={{ display: "flex", gap: "0.75rem", height }}>
      {/* Axe des heures */}
      <div style={{ position: "relative", width: 34, flexShrink: 0 }}>
        {hours.map((h) => (
          <span
            key={h}
            style={{
              position: "absolute",
              top: `${pct(h * 60)}%`,
              right: 0,
              transform: "translateY(-50%)",
              fontSize: "0.7rem",
              color: "var(--text-mute)",
              fontFamily: "var(--font-display)",
            }}
          >
            {String(h).padStart(2, "0")}h
          </span>
        ))}
      </div>

      {/* Ruban */}
      <div
        style={{
          position: "relative",
          width: 8,
          flexShrink: 0,
          background: "var(--bg-3)",
          borderRadius: 999,
        }}
      >
        {nowVisible && (
          <div
            style={{
              position: "absolute",
              top: `${pct(now)}%`,
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "var(--color-brand)",
              border: "3px solid var(--bg)",
              boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-brand) 30%, transparent)",
              animation: "var(--animate-pulse-now)",
              zIndex: 3,
            }}
          />
        )}

        {slotted.map((t) => {
          const top = pct(toMinutes(t.start));
          const segHeight = Math.max(2, pct(endMinutesAdjusted(t.start, t.end)) - top);
          return (
            <div
              key={t.id}
              title={`${t.name} (${t.start}-${t.end})`}
              style={{
                position: "absolute",
                top: `${top}%`,
                height: `${segHeight}%`,
                left: -3,
                width: 14,
                borderRadius: 8,
                background: STATUS_DOT[t.status],
                opacity: t.status === "missed" ? 0.4 : 0.85,
                zIndex: 2,
              }}
            />
          );
        })}
      </div>

      {/* Étiquettes alignées sur leur créneau */}
      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        {slotted.map((t) => (
          <div
            key={t.id}
            title={t.name}
            style={{
              position: "absolute",
              top: `${pct(toMinutes(t.start))}%`,
              left: 0,
              right: 0,
              fontSize: "0.78rem",
              color: "var(--text-soft)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              paddingLeft: 4,
            }}
          >
            <span style={{ color: STATUS_DOT[t.status], marginRight: 6 }}>&#9679;</span>
            {t.name}
          </div>
        ))}
        {nowVisible && (
          <div
            style={{
              position: "absolute",
              top: `${pct(now)}%`,
              transform: "translateY(-50%)",
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "var(--color-brand)",
              right: 0,
            }}
          >
            maintenant
          </div>
        )}
      </div>
    </div>
  );
}
