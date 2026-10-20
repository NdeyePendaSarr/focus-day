/**
 * Ce que le tableau de bord ose dire des estimations.
 *
 * Un rapport réalisé / prévu proche de 1 ne prouve pas que les estimations
 * sont justes. Pendant l'expérimentation, il valait 1,00 parce que le temps
 * réel était validé tel qu'il était pré-rempli (docs/BRIEF-PIVOT.md §1).
 * Conclure « tes estimations tombent juste » aurait affirmé une chose
 * fausse. Avant toute conclusion, on regarde donc si le temps réel est
 * simplement la copie de l'estimation.
 */

import type { Task } from "./types";
import { durationMinutes } from "./time";

/** En dessous, on ne parle pas de tendance : pas d'insight sans données. */
export const MINIMUM_TENDANCE = 5;

/** Au-delà de cette part de temps réels identiques à l'estimation, le
 *  temps réel n'est plus une mesure : on le dit au lieu de conclure. */
export const SEUIL_COPIE = 0.8;

const reference = (t: Task) => t.estimatedMinutes ?? durationMinutes(t.start, t.end);

export function estimationReading(tasks: Task[]): string {
  const mesurees = tasks.filter((t) => t.origin !== "unplanned" && t.actualMinutes != null);
  const n = mesurees.length;
  const s = n > 1 ? "s" : "";

  if (n < MINIMUM_TENDANCE) {
    return `${n} objectif${s} mesuré${s} jusqu'ici. Il en faut au moins ${MINIMUM_TENDANCE} pour parler d'une tendance.`;
  }

  const identiques = mesurees.filter((t) => t.actualMinutes === reference(t)).length;
  if (identiques / n >= SEUIL_COPIE) {
    return (
      `Sur ${n} objectifs mesurés, ${Math.round((identiques / n) * 100)} % ont un temps réel exactement égal à l'estimation. ` +
      "Vérifie qu'il reflète le temps vraiment passé et non le créneau prévu : sinon, l'écart ne mesure rien."
    );
  }

  const ref = mesurees.reduce((a, t) => a + reference(t), 0);
  const reel = mesurees.reduce((a, t) => a + (t.actualMinutes ?? 0), 0);
  if (ref === 0) return `${n} objectifs mesurés, sans estimation à comparer.`;
  const biais = reel / ref;

  if (biais > 1.15) {
    return `Tu passes en moyenne ${biais.toFixed(1).replace(".", ",")} fois le temps que tu estimes, sur ${n} objectifs mesurés.`;
  }
  if (biais < 0.85) {
    return `Tu termines en moyenne en ${Math.round(biais * 100)} % du temps estimé, sur ${n} objectifs mesurés : tes estimations sont larges.`;
  }
  return `Sur ${n} objectifs mesurés, ton temps réel s'écarte en moyenne de ${Math.round(Math.abs(1 - biais) * 100)} % de tes estimations.`;
}
