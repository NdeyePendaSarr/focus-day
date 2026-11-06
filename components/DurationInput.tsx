"use client";

import type { Ref } from "react";
import { parseDuration, formatDuration, durationProblem } from "@/lib/time";

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
  inputRef,
  id,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Texte affiché quand le champ est vide (ex : durée du créneau). */
  hint?: string;
  width?: number;
  autoFocus?: boolean;
  /** Pour y ramener le curseur quand une valeur manque. */
  inputRef?: Ref<HTMLInputElement>;
  id?: string;
  /** Nom annoncé quand aucun <label htmlFor> ne désigne le champ. */
  label?: string;
}) {
  const parsed = parseDuration(value);
  // Illisible, ou plus de 24 h : dit sous le champ, en rouge.
  const problem = durationProblem(value);
  const invalid = problem !== null;

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
        ref={inputRef}
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={id ? `${id}-aide` : undefined}
      />
      <span
        id={id ? `${id}-aide` : undefined}
        // Annonce l'interprétation (« = 1 h 30 ») ou l'erreur, à la frappe.
        aria-live="polite"
        style={{
          fontSize: "0.72rem",
          color: invalid ? "var(--color-rose-text)" : "var(--text-mute)",
          minHeight: "1em",
        }}
      >
        {invalid
          ? problem
          : parsed !== null
            ? `= ${formatDuration(parsed)}`
            : (hint ?? "")}
      </span>
    </div>
  );
}
