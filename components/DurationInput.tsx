"use client";

import { parseDuration, formatDuration } from "@/lib/time";

/**
 * Saisie d'une durée en langage naturel.
 *
 * Un champ "minutes" oblige à convertir de tête dès qu'on pense en
 * heures — et en pratique, à ouvrir une calculatrice pour saisir 1h45.
 * Ici "90", "1h30", "1,5h" ou "45min" sont acceptés indifféremment,
 * et l'interprétation s'affiche sous le champ pour lever le doute.
 */
export default function DurationInput({
  value,
  onChange,
  placeholder,
  hint,
  width = 110,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Texte affiché quand le champ est vide (ex : durée du créneau). */
  hint?: string;
  width?: number;
  autoFocus?: boolean;
}) {
  const parsed = parseDuration(value);
  const invalid = value.trim() !== "" && parsed === null;

  return (
    <div style={{ display: "grid", gap: 3 }}>
      <input
        type="text"
        inputMode="text"
        className="field"
        style={{ width, borderColor: invalid ? "var(--color-rose)" : undefined }}
        placeholder={placeholder ?? "1h30"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
      />
      <span
        style={{
          fontSize: "0.72rem",
          color: invalid ? "var(--color-rose)" : "var(--text-mute)",
          minHeight: "1em",
        }}
      >
        {invalid
          ? "Essaie 90, 1h30 ou 45min"
          : parsed !== null
            ? `= ${formatDuration(parsed)}`
            : (hint ?? "")}
      </span>
    </div>
  );
}
