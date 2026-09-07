"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Éditeur de note d'un objectif.
 *
 * Une note s'écrit APRÈS coup — ce qu'on a appris, ce qui a bloqué. Elle
 * n'a donc rien à faire dans le formulaire de création, qui sert à poser
 * une intention.
 *
 * La mise en forme reste volontairement minimale : gras et italique,
 * écrits en Markdown dans le texte stocké. Un éditeur riche complet
 * demanderait du HTML en base, donc de l'assainissement à l'affichage,
 * pour un gain quasi nul sur des notes de quelques lignes.
 */

/** Rend **gras** et *italique* sans passer par du HTML injecté. */
export function renderNote(text: string): ReactNode[] {
  const morceaux: ReactNode[] = [];
  const motif = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let curseur = 0;
  let cle = 0;
  let m: RegExpExecArray | null;

  while ((m = motif.exec(text)) !== null) {
    if (m.index > curseur) morceaux.push(text.slice(curseur, m.index));
    const jeton = m[0];
    if (jeton.startsWith("**")) {
      morceaux.push(<strong key={cle++}>{jeton.slice(2, -2)}</strong>);
    } else {
      morceaux.push(<em key={cle++}>{jeton.slice(1, -1)}</em>);
    }
    curseur = m.index + jeton.length;
  }
  if (curseur < text.length) morceaux.push(text.slice(curseur));
  return morceaux;
}

export default function NoteEditor({
  open,
  titre,
  valeur,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  titre: string;
  valeur: string;
  onSave: (note: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [texte, setTexte] = useState(valeur);
  const [apercu, setApercu] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTexte(valeur);
      setApercu(false);
    }
  }, [open, valeur]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  /** Entoure la sélection des marqueurs, ou les insère au curseur. */
  const entourer = (marqueur: string) => {
    const el = champ.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const choisi = texte.slice(a, b) || "texte";
    const suivant = texte.slice(0, a) + marqueur + choisi + marqueur + texte.slice(b);
    setTexte(suivant);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + marqueur.length, a + marqueur.length + choisi.length);
    });
  };

  return (
    <div className="note-overlay" onClick={onClose}>
      <div className="note-modal card-surface" onClick={(e) => e.stopPropagation()}>
        <p className="note-eyebrow">Note</p>
        <h2 className="note-title">{titre}</h2>

        <div className="note-toolbar">
          <button className="chip" onClick={() => entourer("**")} title="Gras">
            <strong>G</strong>
          </button>
          <button className="chip" onClick={() => entourer("*")} title="Italique">
            <em>I</em>
          </button>
          <button className="chip" onClick={() => setApercu((v) => !v)}>
            {apercu ? "Écrire" : "Aperçu"}
          </button>
        </div>

        {apercu ? (
          <div className="note-preview">
            {texte.trim() ? renderNote(texte) : "Rien à afficher pour l'instant."}
          </div>
        ) : (
          <textarea
            ref={champ}
            className="field note-field"
            rows={9}
            placeholder="Ce que j'ai appris, ce qui a bloqué, ce à quoi penser la prochaine fois…"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            autoFocus
          />
        )}

        <p className="note-help">
          Entoure un passage de <code>**</code> pour le mettre en gras, de{" "}
          <code>*</code> pour l&apos;italique.
        </p>

        <div className="note-actions">
          {valeur && (
            <button className="chip chip-rose" onClick={onDelete}>
              Supprimer
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="chip" onClick={onClose}>
            Annuler
          </button>
          <button className="btn-primary" onClick={() => onSave(texte.trim())}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
