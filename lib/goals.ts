import type { Goal } from "./types";

/** Parcours proposés dans le sélecteur : les actifs, plus celui déjà
 *  rattaché s'il ne l'est plus — sinon modifier un objectif ancien
 *  effacerait son rattachement sans que personne ne l'ait demandé. */
export function selectableGoals(goals: Goal[], currentId?: string): Goal[] {
  return goals.filter((g) => g.status === "active" || g.id === currentId);
}
