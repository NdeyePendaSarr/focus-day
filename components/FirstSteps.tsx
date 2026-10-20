"use client";

import Link from "next/link";

/**
 * Les premiers pas d'un nouvel utilisateur : la boucle du produit en
 * trois gestes — un parcours, une séance rattachée, une séance validée
 * avec sa note. Chaque étape se coche d'elle-même à partir des données.
 *
 * `hero` : le bouton de l'étape en cours porte le dégradé quand la
 * journée est vide (c'est alors l'action principale de l'écran). Sinon
 * le bouton « + Nouvel objectif » de l'en-tête le garde, et l'étape
 * prend un bouton plein.
 */
export default function FirstSteps({
  hasGoal,
  hasLinkedSession,
  hasValidatedSession,
  hero,
  onNewTask,
  onHide,
}: {
  hasGoal: boolean;
  hasLinkedSession: boolean;
  hasValidatedSession: boolean;
  hero: boolean;
  onNewTask: () => void;
  onHide: () => void;
}) {
  const steps = [
    {
      done: hasGoal,
      title: "Crée ton premier parcours",
      text: "Une formation, une certification, un projet : ce à quoi tu veux consacrer du temps.",
    },
    {
      done: hasLinkedSession,
      title: "Planifie une séance",
      text: "Un créneau dans ta journée, rattaché à ce parcours.",
    },
    {
      done: hasValidatedSession,
      title: "Valide-la et note ce que tu en retiens",
      text: "Le temps passé et ta note rejoignent ton portfolio.",
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  const btn = hero ? "btn-hero" : "btn-primary";

  // La journée a commencé : une seule ligne, l'étape en cours. La carte
  // complète repousserait les objectifs sous la ligne de flottaison.
  if (!hero && current >= 0) {
    const step = steps[current];
    return (
      <div className="card-surface first-steps-line">
        <span className="step-num step-num-sm" aria-hidden="true">{current + 1}</span>
        <p style={{ minWidth: 0, flex: "1 1 260px" }}>
          <strong>Premiers pas, {current}/3</strong> · {step.title}.{" "}
          <span className="first-steps-line-text">{step.text}</span>
        </p>
        {current === 0 && <Link href="/parcours" className="btn-ghost">Créer mon parcours</Link>}
        {current === 1 && <button className="btn-ghost" onClick={onNewTask}>Planifier une séance</button>}
        <button className="link-quiet" onClick={onHide}>Masquer</button>
      </div>
    );
  }

  return (
    <section className="card-surface first-steps">
      {/* Le texte d'introduction sous la ligne du titre, sur toute la
          largeur : à côté de « Masquer », il s'écrasait en colonne étroite
          sur mobile. */}
      <div className="first-steps-head">
        <h2 className="section-title">Tes premiers pas</h2>
        <button className="link-quiet" onClick={onHide}>Masquer</button>
      </div>
      <p className="first-steps-sub">
        FocusDay garde la trace de ce que tu apprends. Trois gestes suffisent pour commencer.
      </p>

      <ol className="first-steps-list">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? "is-done" : i === current ? "is-current" : undefined}>
            <span className="step-num" aria-hidden="true">
              {s.done ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12.5 9.5 18 20 6.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="step-title">
                {s.title}
                {s.done && <span className="sr-only"> (fait)</span>}
              </p>
              {!s.done && <p className="step-text">{s.text}</p>}
              {i === current && i === 0 && (
                <Link href="/parcours" className={`${btn} step-action`}>Créer mon parcours</Link>
              )}
              {i === current && i === 1 && (
                <button className={`${btn} step-action`} onClick={onNewTask}>Planifier une séance</button>
              )}
              {i === current && i === 2 && (
                <p className="step-hint">Depuis sa carte, clique sur « Fait » quand la séance est terminée.</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {current === 0 && (
        <button className="link-quiet" style={{ marginTop: "0.9rem" }} onClick={onNewTask}>
          Ou ajoute un objectif sans parcours
        </button>
      )}
    </section>
  );
}
