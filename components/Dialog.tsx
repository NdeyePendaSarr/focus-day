"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";

/**
 * Fenêtre par-dessus la page : le comportement commun aux quatre fenêtres
 * de l'app (Modal, ConfirmDialog, TaskForm, NoteEditor). Chacune garde son
 * apparence ; celle-ci tient ce qu'elles écrivaient chacune à sa façon,
 * ou pas du tout :
 *
 * - Échap ferme, un clic sur le fond aussi ;
 * - le focus entre dans la fenêtre à l'ouverture, n'en sort pas avec Tab
 *   (sinon il parcourait la page cachée derrière), et revient à la
 *   fermeture là où il était ;
 * - role, aria-modal et un nom : un lecteur d'écran annonce la fenêtre.
 */

/**
 * Dernier élément focalisé HORS d'une fenêtre : c'est là que le focus
 * revient à la fermeture. Lire document.activeElement à l'ouverture ne
 * suffit pas : un champ autoFocus de la fenêtre (le nom, dans TaskForm)
 * a déjà pris le focus, et c'est lui qu'on aurait mémorisé.
 */
let lastOutside: HTMLElement | null = null;
let tracking = false;
function trackFocusOutside() {
  if (tracking) return;
  tracking = true;
  document.addEventListener(
    "focusin",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t && !t.closest('[aria-modal="true"]')) lastOutside = t;
    },
    true
  );
  const active = document.activeElement as HTMLElement | null;
  if (active && !active.closest('[aria-modal="true"]')) lastOutside = active;
}
// Dès le chargement du module, côté navigateur : plusieurs fenêtres
// (TaskForm, NoteEditor) ne montent Dialog qu'à l'ouverture, trop tard
// pour savoir d'où venait le focus.
if (typeof document !== "undefined") trackFocusOutside();

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Dialog({
  open,
  onClose,
  label,
  labelledBy,
  role = "dialog",
  initialFocus,
  overlayClassName,
  overlayStyle,
  className,
  style,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Nom annoncé, si aucun titre visible ne le porte. */
  label?: string;
  /** id du titre visible : préféré à `label`, le nom suit le titre. */
  labelledBy?: string;
  /** "alertdialog" pour une confirmation qui interrompt. */
  role?: "dialog" | "alertdialog";
  /** Élément qui reçoit le focus à l'ouverture. Sans lui : celui qui a
   *  autoFocus, sinon le premier élément focalisable. */
  initialFocus?: RefObject<HTMLElement | null>;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);
  // onClose change souvent d'identité (fonction fléchée du parent) : le
  // lire par ref évite de refaire l'effet, donc de reprendre le focus, à
  // chaque rendu du parent.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Focus : entrer à l'ouverture, revenir à la fermeture.
  useEffect(() => {
    if (!open) return;
    const before = lastOutside;
    const el = card.current;
    if (el && !el.contains(document.activeElement)) {
      const target =
        initialFocus?.current ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el;
      target.focus();
    }
    return () => {
      // La fenêtre a pu supprimer l'élément d'origine (« Supprimer »).
      if (before?.isConnected) before.focus();
    };
    // initialFocus est une ref : stable, lue seulement à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Échap, et Tab qui boucle dans la fenêtre.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !card.current) return;
      const items = Array.from(card.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = card.current.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className={overlayClassName} style={overlayStyle} onClick={() => closeRef.current()}>
      <div
        ref={card}
        role={role}
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={className}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
