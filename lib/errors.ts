/**
 * Messages d'échec affichés à l'utilisateur.
 *
 * Une écriture ratée n'est pas rejouée : useTasks recharge la journée
 * depuis la base, et la modification disparaît de l'écran. Le message
 * doit donc dire qu'elle n'a PAS été enregistrée — un « une erreur est
 * survenue » laisserait croire qu'elle est passée quand même.
 *
 * Validation, note, temps réel et hors-plan rouvrent leur formulaire
 * avec la saisie (TaskCard, DayCatchUp) : le message le dit, au lieu de
 * demander de tout retaper. Les autres actions sont à refaire.
 */

/** Actions dont le formulaire revient avec la saisie après un échec. */
export const KEEPS_INPUT: readonly WriteAction[] = ["complete", "note", "actual", "unplanned"];

const KEPT = "Ta saisie est restée dans le formulaire : tu peux réessayer.";

export type WriteAction =
  | "add"
  | "edit"
  | "status"
  | "complete"
  | "note"
  | "actual"
  | "unplanned"
  | "archive"
  | "remove";

export type GoalWriteAction = "goal_add" | "goal_edit" | "goal_status";

export function writeFailureMessage(action: WriteAction, name: string): string {
  const n = `« ${name.trim() || "sans titre"} »`;
  switch (action) {
    case "add":
      return `L'objectif ${n} n'a pas été ajouté. Il faut le recréer.`;
    case "edit":
      return `Ta modification de ${n} n'a pas été enregistrée. Il faut la refaire.`;
    case "status":
      return `Le changement d'état de ${n} n'a pas été enregistré. Il faut le refaire.`;
    case "complete":
      return `La validation de ${n} et son temps réel n'ont pas été enregistrés. ${KEPT}`;
    case "note":
      return `Ta note sur ${n} n'a pas été enregistrée. ${KEPT}`;
    case "actual":
      return `Le temps réel de ${n} n'a pas été enregistré. ${KEPT}`;
    case "unplanned":
      return `L'activité hors-plan ${n} n'a pas été enregistrée. ${KEPT}`;
    case "archive":
      return `L'archivage de ${n} n'a pas été enregistré. Il faut le refaire.`;
    case "remove":
      return `${n} n'a pas été supprimé. Il faut recommencer.`;
  }
}

export function goalFailureMessage(action: GoalWriteAction, title: string): string {
  const n = `« ${title.trim() || "sans titre"} »`;
  switch (action) {
    case "goal_add":
      // La création attend l'écriture : en cas d'échec, la saisie reste
      // dans le formulaire, il suffit de renvoyer.
      return `Le parcours ${n} n'a pas été créé. Ta saisie est restée dans le formulaire : tu peux réessayer.`;
    case "goal_edit":
      return `Ta modification du parcours ${n} n'a pas été enregistrée. Il faut la refaire.`;
    case "goal_status":
      return `Le changement d'état du parcours ${n} n'a pas été enregistré. Il faut le refaire.`;
  }
}

/** Le message technique, gardé en petit sous la phrase : c'est lui
 *  qu'un utilisateur peut recopier pour signaler le problème. */
export function errorDetail(e: unknown): string | undefined {
  if (e instanceof Error && e.message) {
    // Refus d'une contrainte de longueur (supabase/05_longueurs_max.sql) :
    // le message brut de Postgres ne dit pas quoi faire.
    const len = e.message.match(/check constraint "(\w+)_len"/);
    if (len) return `Un texte dépasse la longueur autorisée (${len[1]}) : raccourcis-le, puis réessaie.`;
    return e.message;
  }
  if (typeof e === "string" && e) return e;
  return undefined;
}
