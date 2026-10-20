import { toMinutes, endMinutesAdjusted } from "./time";

/** Amplitude minimale, pour qu'une journée d'une seule séance reste lisible. */
const MIN_SPAN = 4 * 60;

export type DayRange = { start: number; end: number; hours: number[] };

/**
 * Plage horaire à afficher pour une journée, en minutes depuis minuit.
 *
 * Calée sur les créneaux réels avec une heure de marge de chaque côté,
 * et toujours assez large pour contenir « maintenant » : une journée de
 * deux séances entre 11 h et 15 h n'affiche pas six heures de vide.
 * Graduations toutes les 1, 2 ou 3 heures selon l'amplitude.
 */
export function dayRange(slots: { start: string; end: string }[], now: number): DayRange {
  if (slots.length === 0) return { start: 8 * 60, end: 20 * 60, hours: [8, 11, 14, 17, 20] };

  const starts = slots.map((t) => toMinutes(t.start));
  const ends = slots.map((t) => endMinutesAdjusted(t.start, t.end));

  let lo = Math.min(...starts, now) - 60;
  let hi = Math.max(...ends, now) + 60;
  lo = Math.max(0, Math.floor(lo / 60) * 60);
  hi = Math.min(24 * 60, Math.ceil(hi / 60) * 60);

  if (hi - lo < MIN_SPAN) {
    hi = Math.min(24 * 60, lo + MIN_SPAN);
    lo = Math.max(0, hi - MIN_SPAN);
  }

  const span = hi - lo;
  const step = span > 8 * 60 ? 3 : span > 5 * 60 ? 2 : 1;
  const hours: number[] = [];
  for (let h = Math.ceil(lo / 60); h * 60 <= hi; h += step) hours.push(h);

  return { start: lo, end: hi, hours };
}

/** Position en % d'une minute dans la plage, bornée à [0, 100]. */
export function rangePct(range: DayRange, min: number): number {
  return Math.max(0, Math.min(100, ((min - range.start) / (range.end - range.start)) * 100));
}
