import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy Next.js 16 (ex-middleware). Deux rôles :
 *   1. Rafraîchir le jeton Supabase à chaque requête (sinon la session
 *      expire au bout d'une heure et l'utilisateur est déconnecté).
 *   2. Rediriger vers /login quand aucune session n'est active.
 *
 * Entièrement inactif tant que NEXT_PUBLIC_DATA_SOURCE ne vaut pas
 * "supabase" : l'app continue de fonctionner sur localStorage, sans
 * authentification.
 */
export async function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "supabase") {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() et pas getSession() : getUser valide le jeton auprès de
  // Supabase, getSession se contente de lire le cookie (falsifiable).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = request.nextUrl.pathname;
  // /auth/callback échange le code de confirmation contre une session :
  // le rediriger vers /login ferait perdre le code et la confirmation
  // n'aboutirait jamais.
  const libre = chemin.startsWith("/login") || chemin.startsWith("/auth");

  if (!user && !libre) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques et les images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
