import type { NextConfig } from "next";

/**
 * En-têtes de sécurité, sur toutes les réponses.
 *
 * La CSP se limite volontairement aux directives qui ne cassent rien :
 * pas de script-src. Next injecte des scripts en ligne pour l'hydratation ;
 * les restreindre demande un nonce par requête, donc un rendu dynamique de
 * chaque page, alors qu'elles sont aujourd'hui statiques. Et les données
 * sont protégées par la RLS, pas par le navigateur. Ce qui est posé ici :
 *
 * - frame-ancestors 'none' (et X-Frame-Options pour les vieux navigateurs) :
 *   l'app ne peut pas être affichée dans un cadre d'un autre site, donc pas
 *   de clic détourné sur « Supprimer » ou « Enregistrer » ;
 * - base-uri, form-action, object-src : ferment des portes que l'app
 *   n'utilise pas ;
 * - nosniff : un fichier n'est jamais interprété autrement que son type ;
 * - Referrer-Policy : une adresse de page ne part pas complète vers un
 *   autre site (Open-Meteo, Supabase) ;
 * - Permissions-Policy : la géolocalisation (météo, sur clic) reste
 *   permise à l'app elle-même ; caméra et micro, jamais utilisés, refusés.
 *
 * HSTS n'est pas posé ici : Vercel l'envoie déjà sur son domaine.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
