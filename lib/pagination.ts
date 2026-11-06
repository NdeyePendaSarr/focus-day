/**
 * Lecture complète d'une table, page par page.
 *
 * Supabase plafonne chaque réponse (1 000 lignes par défaut, réglage
 * « Max rows » de l'API). Sans pagination, une requête sans limite ne
 * renvoie que les 1 000 premières lignes, sans erreur ni avertissement :
 * passé ce seuil, le portfolio, l'historique et le tableau de bord
 * perdaient les séances les plus récentes (tri par date croissante).
 *
 * La requête de chaque page doit avoir un ordre total (finir par une
 * colonne unique, l'id) : sinon deux lignes à égalité peuvent changer de
 * place d'une page à l'autre, l'une lue deux fois, l'autre jamais.
 *
 * PAGE_SIZE ne doit pas dépasser le plafond du serveur : une page
 * tronquée par lui serait prise pour la dernière.
 */
export const PAGE_SIZE = 1000;

/** `fetchPage(from, to)` : lignes from à to incluses, comme .range(). */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number = PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    // Page incomplète : c'était la dernière.
    if (page.length < pageSize) return rows;
  }
}
