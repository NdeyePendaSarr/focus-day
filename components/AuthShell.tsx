import type { ReactNode } from "react";

/**
 * Aperçu d'une carte de portfolio : ce que le produit produit, montré
 * plutôt qu'écrit. Exemple figé, purement illustratif (aria-hidden) ;
 * les chiffres restent des heures « consacrées », jamais « mesurées ».
 */
function PortfolioStack() {
  // Trois cartes posées comme sur une table : l'image de la page, c'est
  // le produit lui-même. Les cartes sont du « papier » : couleurs fixes,
  // identiques en thème clair et sombre.
  return (
    <div className="auth-stack" aria-hidden="true">
      <div className="stack-card stack-back">
        <p className="stack-title">
          Google Data Analytics <span className="stack-done">Terminé</span>
        </p>
        <p className="stack-hours">
          {"64 h "}
          <span className="stack-unit">consacrées</span>
        </p>
      </div>

      <div className="stack-card stack-main">
        {/* « Exemple » : ces chiffres sont inventés et ne doivent pas
            passer pour ceux de quelqu'un. */}
        <p className="stack-label">Exemple de portfolio</p>
        <p className="stack-title">Certification Power BI</p>
        <p className="stack-hours stack-hours-lg">
          {"48 h "}
          <span className="stack-unit">consacrées</span>
        </p>
        <p className="stack-facts">22 séances · 19 jours actifs · 14 notes</p>
      </div>

      <div className="stack-card stack-note">
        <p className="stack-label">Ce que j&apos;en retiens</p>
        <p className="stack-quote">
          « CALCULATE modifie le contexte de filtre : revoir ALL et REMOVEFILTERS. »
        </p>
      </div>
    </div>
  );
}

/**
 * Cadre commun des pages d'accès : connexion, mot de passe oublié,
 * nouveau mot de passe. La colonne bleue à gauche, la carte du formulaire
 * à droite ; `children` est le contenu de la carte.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-split">
      {/* Colonne visuelle pleine hauteur, en bleu profond : la promesse,
          puis le produit lui-même en guise d'image. C'est la première
          chose que voit quelqu'un à qui l'on donne le lien. */}
      <aside className="auth-panel">
        <p className="auth-logo auth-logo-light">
          <span className="auth-dot-logo" />
          Focus<span className="auth-logo-day">Day</span>
        </p>

        <div className="auth-panel-body">
          <span className="eyebrow eyebrow-light">Carnet d&apos;apprentissage</span>
          {/* Coupure maîtrisée : la virgule finit la première ligne, et seul
              « gardes » est en couleur. */}
          <h1 className="auth-claim auth-claim-light">
            Ce que tu apprends,
            <br /> tu le <span className="accent-light">gardes</span>.
          </h1>
          <p className="auth-sub auth-sub-light">
            Note tes séances et ce que tu en retiens. FocusDay en fait un
            portfolio que tu peux montrer.
          </p>

          <PortfolioStack />
        </div>
      </aside>

      <main className="auth-form-zone">
        {/* Sur mobile, la colonne visuelle disparaît : le logo revient ici. */}
        <div className="auth-topbar auth-topbar-mobile">
          <p className="auth-logo">
            <span className="auth-dot-logo" />
            Focus<span style={{ color: "var(--color-brand)" }}>Day</span>
          </p>
        </div>

        <section className="auth-form-side">
          <div className="auth-card card-surface">
            {/* Sur mobile le panneau de gauche disparaît : on en garde
                l'essentiel ici, sans quoi la carte flotte sur du vide. */}
            <div className="auth-mobile-head">
              <p className="auth-claim-sm">
                {/* Espaces insécables : « tu le gardes » ne se coupe jamais,
                    sinon « tu » reste orphelin en fin de ligne. */}
                Ce que tu apprends,
                <br /> tu{" "}le{" "}<span className="accent">gardes</span>.
              </p>
            </div>

            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
