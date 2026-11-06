"use client";

import { useEffect, useRef } from "react";

/**
 * Confirmation générique avant une action irréversible.
 * Utilisée pour la suppression définitive.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Échap annule. Entrée n'est plus écoutée sur toute la fenêtre : elle
  // confirmait la suppression même focus sur « Annuler ». Elle active
  // désormais le bouton qui a le focus, comme partout ailleurs.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  // Le focus entre dans la fenêtre, sur « Annuler » : resté sur le bouton
  // « Supprimer » derrière, Entrée rouvrait la confirmation. Pour une
  // action irréversible, le choix par défaut est celui qui ne détruit
  // rien. À la fermeture, il revient là où il était, s'il existe encore.
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="card-surface"
        style={{ width: "100%", maxWidth: 380, padding: "1.5rem", animation: "var(--animate-slide-up)" }}
      >
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          {title}
        </h2>
        <p style={{ fontSize: "0.9rem", color: "var(--text-soft)", marginBottom: "1.4rem", lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: "0.7rem", justifyContent: "flex-end" }}>
          <button ref={cancelRef} className="btn-ghost" onClick={onCancel}>Annuler</button>
          <button
            className="btn-primary"
            onClick={onConfirm}
            style={danger ? { background: "var(--color-rose)" } : undefined}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
