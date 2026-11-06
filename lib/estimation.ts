import type { Task } from "./types";
import { durationMinutes, formatDuration, parseDuration } from "./time";

/**
 * Effort prévu d'une séance : l'estimation si elle a été saisie, sinon
 * la durée du créneau. Une seule définition : elle était recopiée dans
 * sept fichiers, et le tableau de bord, la journée et l'historique
 * auraient divergé au premier changement fait à un seul endroit.
 */
export function plannedMinutes(t: Pick<Task, "estimatedMinutes" | "start" | "end">): number {
  return t.estimatedMinutes ?? durationMinutes(t.start, t.end);
}

/**
 * Écart considéré comme normal entre le réel et le prévu : en deçà, on
 * ne demande pas de cause et on ne le souligne pas. Valait 0.15 à trois
 * endroits, dont un en dur.
 */
export const GAP_TOLERANCE = 0.15;

/** L'écart entre le réel et le prévu dépasse-t-il la tolérance ? */
export function isSignificantGap(actual: number, planned: number): boolean {
  return planned > 0 && Math.abs(actual - planned) / planned > GAP_TOLERANCE;
}

/**
 * Au-delà de cette durée de créneau, l'estimation doit être saisie.
 *
 * En dessous, laisser le champ vide vaut « la durée du créneau » : pour
 * 1 h ou 2 h, c'est une approximation honnête. Au-delà, un créneau de
 * 9 h à 19 h 30 donnait « 10 h 30 estimées », chiffre que personne ne
 * pense vraiment et que le tableau de bord comparait ensuite au réel
 * (relevé du 20 octobre 2026, docs/PRE-LANCEMENT.md §11 bis).
 */
export const LONG_SLOT_MINUTES = 4 * 60;

/**
 * Message d'erreur si l'estimation manque pour un long créneau, sinon
 * null. Un texte illisible compte comme absent : il retomberait sur la
 * durée du créneau sans que personne l'ait voulu.
 */
export function missingEstimation(slotMinutes: number, estimation: string): string | null {
  if (slotMinutes <= LONG_SLOT_MINUTES) return null;
  if (parseDuration(estimation) !== null) return null;
  return `Ce créneau dure ${formatDuration(slotMinutes)} : combien de temps penses-tu y passer vraiment ?`;
}
