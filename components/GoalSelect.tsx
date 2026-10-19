"use client";

import type { Goal } from "@/lib/types";
import { selectableGoals } from "@/lib/goals";

/**
 * Choix du parcours, partagé par le formulaire d'objectif et la saisie
 * hors-plan. Ne rend rien s'il n'y a aucun parcours à proposer : à
 * l'appelant de décider s'il affiche une indication à la place.
 */
export default function GoalSelect({
  id,
  goals,
  value,
  currentId,
  onChange,
  style,
}: {
  id?: string;
  goals: Goal[];
  /** "" = aucun parcours. */
  value: string;
  /** Parcours déjà rattaché : proposé même s'il n'est plus actif. */
  currentId?: string;
  onChange: (goalId: string) => void;
  style?: React.CSSProperties;
}) {
  const options = selectableGoals(goals, currentId);
  if (options.length === 0) return null;

  return (
    <select
      id={id}
      className="field"
      aria-label="Parcours"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={style}
    >
      <option value="">Aucun parcours</option>
      {options.map((g) => (
        <option key={g.id} value={g.id}>{g.title}</option>
      ))}
    </select>
  );
}
