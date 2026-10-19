/**
 * Messages d'échec affichés à l'utilisateur.
 *
 * Une écriture ratée n'est pas rejouée : useTasks recharge la journée
 * depuis la base, et la modification disparaît de l'écran. Le message
 * doit donc dire qu'elle n'a PAS été enregistrée et qu'il faut la
 * refaire — un « une erreur est survenue » laisserait croire qu'elle
 * est passée quand même.
 */

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
      return `La validation de ${n} et son temps réel n'ont pas été enregistrés. Il faut les refaire.`;
    case "note":
      return `Ta note sur ${n} n'a pas été enregistrée. Il faut la réécrire.`;
    case "actual":
      return `Le temps réel de ${n} n'a pas été enregistré. Il faut le ressaisir.`;
    case "unplanned":
      return `L'activité hors-plan ${n} n'a pas été enregistrée. Il faut la ressaisir.`;
    case "archive":
      return `L'archivage de ${n} n'a pas été enregistré. Il faut le refaire.`;
    case "remove":
      return `${n} n'a pas été supprimé. Il faut recommencer.`;
  }
}

/** Le message technique, gardé en petit sous la phrase : c'est lui
 *  qu'un utilisateur peut recopier pour signaler le problème. */
export function errorDetail(e: unknown): string | undefined {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  return undefined;
}
