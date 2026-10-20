/**
 * Réessai unique quand Supabase refuse un jeton « émis dans le futur ».
 *
 * PGRST303 « JWT issued at future » : juste après une connexion, le jeton
 * remis par le service d'authentification porte une heure d'émission un
 * peu en avance sur l'horloge du service qui lit la base. Le refus dure
 * quelques secondes (incident du 20 octobre 2026, docs/PRE-LANCEMENT.md).
 *
 * Sans réessai, une séance validée dans ces secondes-là échoue, et la note
 * est à retaper : de quoi pousser vers « sans note » la fois suivante, et
 * fausser la mesure.
 *
 * Trois règles :
 * - uniquement sur PGRST303, jamais sur une autre erreur ;
 * - une seule fois : si le second essai échoue, l'erreur remonte et le
 *   bandeau s'affiche comme avant ;
 * - sans risque pour les écritures : PGRST303 est un refus du jeton,
 *   prononcé avant toute exécution SQL. Le premier essai n'a rien écrit.
 */

/** Préfixe du message produit par fail() dans repo.supabase.ts. */
const PGRST303 = "[PGRST303]";

export const RETRY_DELAY_MS = 2000;

export function isJwtFuture(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(PGRST303);
}

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function retryOnJwtFuture<T>(
  fn: () => Promise<T>,
  wait: (ms: number) => Promise<void> = pause
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isJwtFuture(e)) throw e;
    await wait(RETRY_DELAY_MS);
    return fn();
  }
}

/** Applique le réessai à chaque méthode d'un dépôt (tasks, debriefs, goals). */
export function withJwtRetry<R extends object>(repo: R): R {
  const wrapped = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(repo)) {
    wrapped[key] =
      typeof value === "function"
        ? (...args: unknown[]) => retryOnJwtFuture(() => value.apply(repo, args))
        : value;
  }
  return wrapped as R;
}
