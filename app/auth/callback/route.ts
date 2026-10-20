import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Retour des liens envoyés par email.
 *
 * Deux cas, distingués par le paramètre `next` :
 *
 * - **Confirmation d'inscription** (pas de `next`). Supabase a déjà
 *   confirmé l'adresse avant de rediriger ici : le `code` ne sert qu'à
 *   ouvrir une session. On ne l'ouvre pas : retour à la page de connexion
 *   avec « Adresse confirmée. Connecte-toi pour commencer. » C'est un
 *   choix d'expérience — un message clair, puis une connexion explicite.
 *
 * - **Lien avec une destination** (`next`, par exemple la réinitialisation
 *   du mot de passe). Là, la session est indispensable : sans elle, on ne
 *   peut pas définir le nouveau mot de passe. Le `code` est échangé contre
 *   une session, puis redirection vers `next`.
 *
 * Sans cette route, le code arrivait sur la page d'accueil et le proxy
 * renvoyait aussitôt vers /login : le paramètre était perdu.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Lien de réinitialisation inutilisable (expiré, déjà servi, ou ouvert
  // dans un autre navigateur que celui de la demande) : retour à la
  // demande, avec un message qui dit quoi faire. Le message générique de
  // /login parlerait d'adresse confirmée, ce qui serait faux ici.
  const demandeANouveau = `${origin}/login/mot-de-passe-oublie?lien=expire`;

  // Lien expiré ou déjà utilisé : Supabase redirige avec une erreur au
  // lieu d'un code. Souvent, c'est l'antivirus de la messagerie qui l'a
  // ouvert en premier — et l'adresse est alors bel et bien confirmée.
  if (!code) {
    if (next) return NextResponse.redirect(demandeANouveau);
    return NextResponse.redirect(`${origin}/login?auth=lien-invalide`);
  }

  if (!next) {
    return NextResponse.redirect(`${origin}/login?auth=confirmee`);
  }

  // N'accepter qu'un chemin interne : un `next` comme « //exemple.com »
  // ferait de cette route une redirection ouverte vers un autre site.
  const suite = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // La réponse est créée d'abord : c'est sur elle que les cookies de
  // session doivent être posés pour survivre à la redirection.
  const response = NextResponse.redirect(`${origin}${suite}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(demandeANouveau);
  }

  return response;
}
