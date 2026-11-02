import { formatDuration, parseDuration } from "./time";

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
