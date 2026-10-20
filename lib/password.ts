/**
 * Politique de mot de passe : une longueur minimale, rien d'autre.
 *
 * Pas d'exigence « une majuscule, un chiffre, un symbole » : elle pousse
 * vers « Motdepasse1! » sans rendre le mot de passe plus sûr. La longueur
 * compte davantage.
 *
 * La règle qui fait foi est côté Supabase (Authentication → Providers →
 * Email → Minimum password length), qui doit valoir la même chose :
 * cette vérification-ci sert seulement à dire tout de suite ce qui manque,
 * avant l'aller-retour.
 */
export const MIN_PASSWORD = 8;

/** Ce qui manque au mot de passe, ou null s'il convient. */
export function passwordProblem(password: string): string | null {
  // Compter en caractères, pas en unités UTF-16 : « é » ou un emoji
  // comptent pour un, comme Supabase les compte.
  const longueur = Array.from(password).length;
  const manque = MIN_PASSWORD - longueur;
  if (manque <= 0) return null;
  if (longueur === 0) return `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`;
  return `Encore ${manque} caractère${manque > 1 ? "s" : ""} : ${MIN_PASSWORD} au minimum.`;
}

/** Indication sous le champ, mise à jour pendant la frappe. */
export function passwordHint(password: string): string {
  if (!password) return `${MIN_PASSWORD} caractères minimum.`;
  return passwordProblem(password) ?? "Longueur suffisante.";
}
