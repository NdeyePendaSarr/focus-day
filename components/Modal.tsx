"use client";

import { useId, type ReactNode } from "react";
import Dialog from "@/components/Dialog";

/**
 * Fenêtre par-dessus la page : fond assombri, fermeture par Échap ou par
 * un clic à côté. Le comportement (focus, Échap, nom annoncé) est celui
 * de Dialog ; ici, seulement l'apparence et le titre.
 */
export default function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      overlayClassName="modal-overlay"
      className="card-surface modal-card"
    >
      <h2 id={titleId} className="modal-title">{title}</h2>
      {children}
    </Dialog>
  );
}
