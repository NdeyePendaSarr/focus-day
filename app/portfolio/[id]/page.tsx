"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { usePortfolio } from "@/lib/usePortfolio";
import { plural } from "@/lib/portfolio";
import { prettyDate, formatDuration } from "@/lib/time";
import NavBar from "@/components/NavBar";
import ErrorBanner from "@/components/ErrorBanner";
import PortfolioStats from "@/components/PortfolioStats";
import { renderNote } from "@/components/NoteEditor";

/**
 * Détail d'un parcours : toutes ses notes, puis toutes ses séances, dans
 * l'ordre où elles ont eu lieu — on relit une progression, pas un flux.
 */
export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { portfolio, ready, loadError, retry } = usePortfolio();
  const s = [...portfolio.done, ...portfolio.active, ...portfolio.other].find((x) => x.goal.id === id);
  const notes = s?.sessions.filter((t) => (t.note ?? "").trim() !== "") ?? [];

  return (
    <>
      <NavBar />
      <main className="page-shell" style={{ paddingTop: "1.5rem", paddingBottom: "4rem", maxWidth: 1000 }}>
        <Link href="/portfolio" className="pf-back no-print">← Portfolio</Link>

        {loadError && (
          <div style={{ margin: "1rem 0" }}>
            <ErrorBanner
              message="Ce parcours n'a pas pu être chargé depuis le serveur. Les chiffres affichés peuvent être incomplets."
              detail={loadError}
              actionLabel="Réessayer"
              onAction={retry}
            />
          </div>
        )}

        {!ready ? (
          <p className="parcours-empty" style={{ marginTop: "1rem" }}>Chargement…</p>
        ) : !s ? (
          <p className="parcours-empty" style={{ marginTop: "1rem" }}>Ce parcours n&apos;existe pas ou plus.</p>
        ) : (
          <>
            <div style={{ margin: "1rem 0 1.75rem" }}>
              <span className="eyebrow" style={{ marginBottom: "0.9rem" }}>Parcours</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h1 className="display-title" style={{ fontSize: "clamp(2rem, 4.5vw, 2.8rem)", overflowWrap: "anywhere" }}>
                  {s.goal.title}
                </h1>
                {s.goal.status === "done" && <span className="pf-done-tag">Terminé</span>}
              </div>
              {s.goal.why && <p className="pf-why" style={{ fontSize: "0.95rem", marginTop: "0.6rem" }}>{s.goal.why}</p>}
              {s.goal.targetDate && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-mute)", marginTop: 4 }}>
                  Échéance visée : {prettyDate(s.goal.targetDate)}
                </p>
              )}
            </div>

            {s.sessions.length === 0 ? (
              <p className="pf-empty-card">
                Aucune séance rattachée pour l&apos;instant. Choisis ce parcours dans le
                formulaire d&apos;un objectif ou d&apos;une activité hors-plan.
              </p>
            ) : (
              <>
                <div className="card-surface" style={{ padding: "1.1rem 1.25rem", marginBottom: "0.6rem" }}>
                  <PortfolioStats s={s} large />
                </div>
                <p className="pf-disclaimer">
                  Heures saisies dans FocusDay, séance par séance : elles ne comptent pas
                  tout le travail fait ailleurs.
                </p>

                <section style={{ margin: "1.75rem 0" }}>
                  <h2 className="parcours-section-title">Ce que tu en as retenu</h2>
                  {notes.length === 0 ? (
                    <p className="parcours-empty">
                      Aucune note pour l&apos;instant. La question « Qu&apos;est-ce que tu en
                      retiens ? » est posée à chaque séance validée de ce parcours.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {notes.map((t) => (
                        <article key={t.id} className="card-surface pf-note">
                          <p className="pf-note-meta">
                            {prettyDate(t.date)} · {t.name}
                          </p>
                          <p className="pf-note-text">{renderNote(t.note ?? "")}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h2 className="parcours-section-title">
                    {plural(s.sessions.length, "séance", "séances")}
                  </h2>
                  <div className="card-surface" style={{ padding: "0.25rem 0" }}>
                    {s.sessions.map((t) => (
                      <div key={t.id} className="pf-session">
                        <span className="pf-session-date">{prettyDate(t.date)}</span>
                        <span className="pf-session-name">
                          {t.name}
                          {t.origin === "unplanned" && <span className="goal-tag" style={{ marginLeft: 6 }}>Hors plan</span>}
                        </span>
                        <span className="pf-session-time">{formatDuration(t.actualMinutes ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                  {/* « Pas noté » n'est pas « pas fait » : ces séances ne sont
                      ni comptées à zéro ni passées sous silence. */}
                  {s.unmeasured > 0 && (
                    <p className="pf-unattached">
                      {`${plural(s.unmeasured, "séance prévue", "séances prévues")} sans temps saisi ${
                        s.unmeasured < 2 ? "n'est pas comptée" : "ne sont pas comptées"
                      }.`}
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
