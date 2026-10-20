/**
 * Les messages de Supabase arrivent en anglais et parlent au développeur.
 * On les traduit en phrases qui disent quoi faire.
 */
export function messageFr(brut: string): string {
  const m = brut.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("already registered")) return "Un compte existe déjà avec cette adresse.";
  if (m.includes("password should be at least"))
    return "Le mot de passe doit faire au moins 6 caractères.";
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
