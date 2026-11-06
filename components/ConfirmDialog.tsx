"use client";

import { useId, useRef } from "react";
import Dialog from "@/components/Dialog";

/**
 * Confirmation générique avant une action irréversible.
 * Utilisée pour la suppression définitive.
 *
 * Entrée n'est pas écoutée sur toute la fenêtre : elle confirmait la
 * suppression même focus sur « Annuler ». Elle active le bouton qui a le
 * focus, comme partout ailleurs. Le focus entre sur « Annuler » : pour
 * une action irréversible, le choix par défaut est celui qui ne détruit
 * rien. Échap, Tab et le retour du focus sont tenus par Dialog.
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
  const titleId = useId();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      role="alertdialog"
      labelledBy={titleId}
      initialFocus={cancelRef}
      overlayStyle={{
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
      className="card-surface"
      style={{ width: "100%", maxWidth: 380, padding: "1.5rem", animation: "var(--animate-slide-up)" }}
    >
      <h2
        id={titleId}
        style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}
      >
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
    </Dialog>
  );
}
