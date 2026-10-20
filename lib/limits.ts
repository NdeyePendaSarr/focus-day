/**
 * Longueurs maximales des champs texte, en caractères.
 *
 * Mêmes valeurs que les contraintes CHECK de la base
 * (supabase/05_longueurs_max.sql) : les deux doivent bouger ensemble.
 * Choisies larges, bien au-dessus des saisies réelles — elles bloquent
 * l'abus (une note de plusieurs mégaoctets), pas l'usage.
 */
export const LIMITS = {
  /** « Ce que j'en retiens » : environ 1 500 mots. */
  note: 10_000,
  taskTitle: 200,
  description: 1_000,
  why: 1_000,
  goalTitle: 200,
  debriefNote: 2_000,
} as const;

/** À partir de quelle part de la limite le compteur s'affiche. */
const SEUIL = 0.8;

/**
 * Compteur à afficher sous un champ, ou null tant qu'on est loin de la
 * limite : un compteur permanent serait du bruit, mais atteindre la
 * limite sans prévenir couperait la saisie en silence.
 */
export function charCount(value: string, max: number): { label: string; full: boolean } | null {
  // value.length, en unités UTF-16 : c'est ce que compte maxLength.
  const n = value.length;
  if (n < max * SEUIL) return null;
  const fmt = (x: number) => x.toLocaleString("fr-FR");
  return {
    label:
      n >= max
        ? `${fmt(n)} / ${fmt(max)} — limite atteinte`
        : `${fmt(n)} / ${fmt(max)}`,
    full: n >= max,
  };
}
