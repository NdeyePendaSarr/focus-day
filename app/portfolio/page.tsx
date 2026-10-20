"use client";

import Link from "next/link";
import type { GoalSummary } from "@/lib/portfolio";
import { usePortfolio } from "@/lib/usePortfolio";
import { formatDuration } from "@/lib/time";
import NavBar from "@/components/NavBar";
import ErrorBanner from "@/components/ErrorBanner";
import PortfolioStats from "@/components/PortfolioStats";
import PageHeader from "@/components/PageHeader";

export default function PortfolioPage() {
  const { portfolio, goals, ready, loadError, retry } = usePortfolio();
  const { done, active, other, unattachedMinutes } = portfolio;

  return (
    <>
      <NavBar />
      <main className="page-shell" style={{ paddingTop: "1.5rem", paddingBottom: "4rem" }}>
        {loadError && (
          <div style={{ marginBottom: "1.25rem" }}>
            <ErrorBanner
              message="Ton portfolio n'a pas pu être chargé depuis le serveur. Les chiffres affichés peuvent être incomplets."
              detail={loadError}
              actionLabel="Réessayer"
              onAction={retry}
            />
          </div>
        )}

        <PageHeader
          eyebrow="Portfolio"
          before="Ce que tu y as"
          accent="consacré"
          sub="Chacun de tes parcours, les heures que tu y as mises, et ce que tu en as retenu."
          action={
            goals.length > 0 ? (
              <button className="btn-ghost" onClick={() => window.print()}>Imprimer</button>
            ) : undefined
          }
        />

        {/* Les heures sont déclaratives : le dire une fois, clairement,
            plutôt que de laisser croire à un total exhaustif. */}
        {goals.length > 0 && (
          <p className="pf-disclaimer">
            Les heures sont celles saisies dans FocusDay, séance par séance. Elles
            ne comptent pas tout le travail fait ailleurs.
          </p>
        )}

        {!ready ? (
          <p className="parcours-empty">Chargement…</p>
        ) : goals.length === 0 ? (
          <EmptyPortfolio />
        ) : (
          <>
            {done.length > 0 && (
              <Section titre="Menés à terme">
                {done.map((s) => <GoalCard key={s.goal.id} s={s} />)}
              </Section>
            )}
            {active.length > 0 && (
              <Section titre="En cours">
                {active.map((s) => <GoalCard key={s.goal.id} s={s} />)}
              </Section>
            )}
            {other.length > 0 && (
              <Section titre="En pause">
                {other.map((s) => <GoalCard key={s.goal.id} s={s} />)}
              </Section>
            )}

            {unattachedMinutes > 0 && (
              <p className="pf-unattached">
                {`${formatDuration(unattachedMinutes)} saisies sur des séances sans parcours n'apparaissent pas ici.`}
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2 className="parcours-section-title">{titre}</h2>
      <div className="pf-grid">{children}</div>
    </section>
  );
}

function GoalCard({ s }: { s: GoalSummary }) {
  const { goal } = s;
  const termine = goal.status === "done";
  const vide = s.sessions.length === 0;

  return (
    <article className={`card-surface pf-card${termine ? " pf-card-done" : ""}`}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h3 className="pf-title">{goal.title}</h3>
        {termine && <span className="pf-done-tag">Terminé</span>}
        {goal.status === "paused" && <span className="goal-tag">En pause</span>}
        {goal.status === "abandoned" && <span className="goal-tag">Arrêté</span>}
      </div>
      {goal.why && <p className="pf-why">{goal.why}</p>}

      {vide ? (
        // Premier jour : une carte vide doit dire comment la remplir,
        // pas afficher un « 0 min » qui ressemble à un constat d'échec.
        <p className="pf-empty-card">
          Aucune séance rattachée pour l&apos;instant. Choisis ce parcours dans le
          formulaire d&apos;un objectif ou d&apos;une activité hors-plan : chaque
          séance validée s&apos;ajoutera ici.
        </p>
      ) : (
        <>
          <PortfolioStats s={s} />
          <Link href={`/portfolio/${goal.id}`} className="pf-link no-print">
            Voir les séances et les notes →
          </Link>
        </>
      )}
    </article>
  );
}

function EmptyPortfolio() {
  return (
    <div className="card-surface" style={{ padding: "2.5rem 1.5rem", textAlign: "center", maxWidth: 640 }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 600, marginBottom: 6 }}>
        Ton portfolio se construit à partir de tes parcours.
      </p>
      <p style={{ color: "var(--text-soft)", fontSize: "0.9rem", marginBottom: "1.2rem" }}>
        Crée un parcours — une formation, une certification, un projet — puis
        rattaches-y tes objectifs. Chaque séance validée s&apos;ajoute ici, avec
        ce que tu en as retenu.
      </p>
      <Link href="/parcours" className="btn-hero" style={{ display: "inline-block" }}>
        Créer un parcours
      </Link>
    </div>
  );
}
