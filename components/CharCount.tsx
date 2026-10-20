import { charCount } from "@/lib/limits";

/**
 * Compteur de caractères sous un champ. Invisible tant qu'on est loin de
 * la limite ; apparaît à 80 %, passe en rouge à la limite.
 */
export default function CharCount({ value, max }: { value: string; max: number }) {
  const c = charCount(value, max);
  if (!c) return null;
  return (
    <p className={`char-count${c.full ? " char-count-full" : ""}`} aria-live="polite">
      {c.label}
    </p>
  );
}
