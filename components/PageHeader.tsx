import type { ReactNode } from "react";

/**
 * En-tête commun des écrans : pastille d'intitulé, grand titre très gras
 * avec un mot en couleur, phrase d'accroche, et à droite l'éventuelle
 * action de l'écran.
 *
 * `action` reçoit au plus le bouton principal de l'écran : c'est le seul
 * qui peut porter .btn-hero (dégradé et halo, un par écran).
 */
export default function PageHeader({
  eyebrow,
  before,
  accent,
  after = ".",
  sub,
  action,
}: {
  eyebrow: ReactNode;
  /** Texte du titre avant le mot en couleur. */
  before?: string;
  /** Le mot (ou groupe de mots) en couleur. */
  accent: string;
  after?: string;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div style={{ minWidth: 0 }}>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="display-title" style={{ marginTop: "0.9rem" }}>
          {before ? `${before} ` : ""}
          <span className="accent">{accent}</span>
          {after}
        </h1>
        {sub && <p className="page-header-sub">{sub}</p>}
      </div>
      {action && <div className="no-print">{action}</div>}
    </div>
  );
}
