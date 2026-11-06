import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté navigateur.
 *
 * Instancié paresseusement : tant que NEXT_PUBLIC_DATA_SOURCE vaut "local",
 * ce fichier est importé mais aucun client n'est créé et aucune variable
 * d'environnement n'est exigée. L'app continue de tourner sur localStorage.
 *
 * createBrowserClient (@supabase/ssr) stocke la session dans des cookies,
 * ce qui permet au middleware de la lire côté serveur. C'est la différence
 * avec createClient de @supabase/supabase-js, qui utilise localStorage et
 * resterait invisible au middleware.
 */

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase non configuré : renseigne NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local, puis redémarre le serveur."
    );
  }

  client = createBrowserClient(url, key);
  return client;
}

/**
 * Identifiant de l'utilisateur connecté, ou null.
 *
 * Lu dans la session locale (getSession), sans aller-retour réseau :
 * getUser interrogeait le service d'authentification avant CHAQUE
 * enregistrement. Ce n'est pas une décision de sécurité : l'id sert
 * seulement à remplir user_id, et la base le vérifie elle-même (RLS,
 * auth.uid() = user_id). Un id falsifié serait refusé par Postgres.
 * La vérification du jeton qui compte reste celle du proxy (getUser).
 */
export async function currentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}
