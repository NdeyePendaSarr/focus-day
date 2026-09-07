import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Retour du lien de confirmation envoyé par email.
 *
 * Supabase redirige ici avec un paramètre `code` à usage unique, qu'il
 * faut échanger contre une session côté serveur. Sans cette route, le
 * code arrivait sur la page d'accueil et le proxy renvoyait aussitôt
 * vers /login : le paramètre était perdu et la confirmation restait
 * sans effet.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const suite = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?auth=lien-invalide`);
  }

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
    return NextResponse.redirect(`${origin}/login?auth=lien-expire`);
  }

  return response;
}
