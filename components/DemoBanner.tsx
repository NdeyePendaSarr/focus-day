"use client";

import { IS_DEMO, resetDemo } from "@/lib/demo";

/**
 * Bandeau du mode démo, en haut de chaque page : dit tout de suite que
 * les données sont fictives et restent dans le navigateur, et permet de
 * repartir de zéro. Sans lui, un visiteur pourrait croire voir le carnet
 * de quelqu'un, ou s'inquiéter d'écrire dans une vraie base.
 */
export default function DemoBanner() {
  if (!IS_DEMO) return null;

  const reinitialiser = () => {
    try {
      resetDemo(localStorage);
    } catch {
      /* stockage indisponible : rien à effacer */
    }
    // Rechargement complet, voulu : toute l'app relit le stockage et
    // repart des données fictives, recalées sur l'heure actuelle.
    window.location.replace(`${window.location.origin}/`);
  };

  return (
    <aside className="demo-banner" aria-label="Mode démo">
      <p>
        <strong>Démo</strong> — données fictives. Essaie tout : tes saisies
        restent dans ce navigateur.
      </p>
      <span className="demo-banner-actions">
        <button type="button" onClick={reinitialiser}>
          Réinitialiser la démo
        </button>
        <a href="https://github.com/NdeyePendaSarr/focus-day" target="_blank" rel="noopener noreferrer">
          Code source
        </a>
      </span>
    </aside>
  );
}
