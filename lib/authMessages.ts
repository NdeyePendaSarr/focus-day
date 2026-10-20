/**
 * Les messages de Supabase arrivent en anglais et parlent au développeur.
 * On les traduit en phrases qui disent quoi faire.
 */
export function messageFr(brut: string): string {
  const m = brut.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("already registered")) return "Un compte existe déjà avec cette adresse.";
  // Le minimum vient du réglage Supabase : on reprend son chiffre plutôt
  // que d'en afficher un qui pourrait ne plus être le bon.
  if (m.includes("password should be at least")) {
    const n = brut.match(/\d+/)?.[0];
    return `Le mot de passe doit faire au moins ${n ?? "8"} caractères.`;
  }
  // Mot de passe trop courant (réglage « mots de passe compromis »).
  if (m.includes("weak") || m.includes("pwned") || m.includes("leaked"))
    return "Ce mot de passe est trop courant ou a déjà fuité ailleurs. Choisis-en un autre.";
  if (m.includes("should be different from the old password"))
    return "Choisis un mot de passe différent de l'actuel.";
  if (m.includes("email not confirmed"))
    return "Adresse non confirmée. Ouvre le lien reçu par email.";
  if (m.includes("unable to validate email")) return "Cette adresse email n'est pas valide.";
  // Supabase limite l'envoi d'emails : un lien par minute et par adresse.
  if (m.includes("rate limit") || m.includes("for security purposes"))
    return "Trop de demandes d'affilée. Attends une minute, puis réessaie.";
  if (m.includes("auth session missing"))
    return "Ce lien a expiré. Demande un nouveau lien de réinitialisation.";
  if (m.includes("failed to fetch")) return "Connexion impossible. Vérifie ton réseau.";
  return brut;
}
