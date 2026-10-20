"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task, DebriefEntry } from "@/lib/types";
import { GAP_REASONS } from "@/lib/types";
import { repo } from "@/lib/repo";
import { todayISO, shiftISO, durationMinutes, formatDuration, prettyDate } from "@/lib/time";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { MOODS, Visage } from "@/components/EveningDebrief";
import { estimationReading } from "@/lib/lecture";
import PageHeader from "@/components/PageHeader";

/** Fenêtre d'observation : assez large pour voir une tendance, assez
 *  courte pour que chaque jour reste lisible. */
const FENETRE = 14;

type Jour = {
  date: string;
  prevu: number;
  reel: number;
  horsPlan: number;
  renseigne: boolean;
};

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [debriefs, setDebriefs] = useState<DebriefEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [allTasks, allDebriefs] = await Promise.all([
          repo.tasks.all(),
          repo.debriefs.all(),
        ]);
        setTasks(allTasks.filter((t) => !t.archived));
        setDebriefs(allDebriefs);
      } catch (e) {
        console.error("Chargement du tableau de bord impossible", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const d = useMemo(() => {
    const today = todayISO();

    // La fenêtre est continue : un jour sans rien y figure comme jour vide.
    // C'est l'information la plus importante du graphique — un trou dans
    // le suivi ne doit pas être masqué en rapprochant les barres.
    const dates: string[] = [];
    for (let i = FENETRE - 1; i >= 0; i--) dates.push(shiftISO(today, -i));

    const jours: Jour[] = dates.map((date) => {
      const duJour = tasks.filter((t) => t.date === date);
      const planifies = duJour.filter((t) => t.origin !== "unplanned");
      return {
        date,
        prevu: planifies.reduce(
          (s, t) => s + (t.estimatedMinutes ?? durationMinutes(t.start, t.end)),
          0
        ),
        reel: duJour.reduce((s, t) => s + (t.actualMinutes ?? 0), 0),
        horsPlan: duJour
          .filter((t) => t.origin === "unplanned")
          .reduce((s, t) => s + (t.actualMinutes ?? 0), 0),
        renseigne: duJour.some((t) => t.actualMinutes != null),
      };
    });

    const joursAvecPlan = jours.filter((j) => j.prevu > 0).length;
    const joursRenseignes = jours.filter((j) => j.renseigne).length;

    // Uniquement les jours renseignés : additionner le prévu de journées
    // dont le réel est inconnu produirait un écart qui ne mesure rien.
    // "Pas fait" et "pas noté" ne doivent jamais se confondre.
    const mesures = jours.filter((j) => j.renseigne);
    const prevuTotal = mesures.reduce((s, j) => s + j.prevu, 0);
    const reelTotal = mesures.reduce((s, j) => s + j.reel, 0);
    const horsPlanTotal = mesures.reduce((s, j) => s + j.horsPlan, 0);

    // La lecture des estimations est dans lib/lecture.ts (seuil de
    // tendance, détection du temps réel recopié).

    // Causes d'écart déclarées
    const causes = GAP_REASONS.map((r) => ({
      label: r.label,
      n: tasks.filter((t) => t.gapReason === r.value).length,
    }))
      .filter((c) => c.n > 0)
      .sort((a, b) => b.n - a.n);

    // Dernière journée avec un temps réel, toutes périodes confondues :
    // c'est ce qu'on dit quand la fenêtre de 14 jours est vide.
    const dernierJour = tasks
      .filter((t) => t.actualMinutes != null)
      .reduce<string | null>((m, t) => (m === null || t.date > m ? t.date : m), null);

    return {
      jours,
      dernierJour,
      joursAvecPlan,
      joursRenseignes,
      prevuTotal,
      reelTotal,
      horsPlanTotal,
      causes,
    };
  }, [tasks]);

  return (
    <>
      <NavBar />
      <main className="page-shell" style={{ paddingTop: "1.5rem", paddingBottom: "4rem" }}>
        <PageHeader
          eyebrow={`Les ${FENETRE} derniers jours`}
          before="Ton"
          accent="tableau de bord"
          sub="Ce que tu avais prévu, ce que tu as fait — jour par jour."
        />

        {/* Fenêtre vide : des « 0 min » partout ressemblent à un constat
            d'échec. On dit ce qui se passe, et où retrouver le reste. */}
        {ready && d.joursRenseignes === 0 ? (
          <section className="card-surface dash-empty">
            <p className="section-title">
              Aucune journée renseignée ces {FENETRE} derniers jours.
            </p>
            <p className="dash-empty-text">
              {d.dernierJour
                ? `La dernière remonte au ${prettyDate(d.dernierJour)}. Tout ton travail passé reste dans l'historique et le portfolio.`
                : "Renseigne le temps réel d'une première journée : ce tableau se remplira à partir de là."}
            </p>
            {d.dernierJour && (
              <Link href="/history" className="btn-ghost" style={{ justifySelf: "start" }}>
                Voir l&apos;historique
              </Link>
            )}
          </section>
        ) : (
        <>
        <div className="dash-stats">
          <Chiffre
            valeur={ready ? `${d.joursRenseignes} / ${FENETRE}` : "—"}
            libelle="jours renseignés"
            aide="Jours où tu as noté au moins un temps réel"
          />
          <Chiffre
            valeur={ready ? formatDuration(d.prevuTotal) : "—"}
            libelle="prévues"
            aide="Sur les jours renseignés"
          />
          <Chiffre
            valeur={ready ? formatDuration(d.reelTotal) : "—"}
            libelle="réalisées"
            couleur="var(--color-mint-text)"
            aide="Sur les mêmes jours, hors-plan compris"
          />
          <Chiffre
            valeur={ready ? formatDuration(d.horsPlanTotal) : "—"}
            libelle="hors plan"
            couleur="var(--color-amber-text)"
            aide="Fait sans l'avoir prévu"
          />
        </div>

        <section className="card-surface" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h2 className="section-title">
            Prévu et réalisé, jour par jour
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-mute)", marginBottom: "1.1rem" }}>
            Gris = prévu, bleu = réalisé. Trait pointillé = journée planifiée
            dont le temps réel n&apos;a jamais été renseigné. Aucune barre = rien
            de planifié ce jour-là.
          </p>

          {!ready ? (
            <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>Chargement…</p>
          ) : (
            <Graphique jours={d.jours} />
          )}
        </section>
        </>
        )}

        <section className="card-surface" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h2 className="section-title">
            Ce que les données disent
          </h2>
          {/* Chaque section dit sur quelle période elle porte : celle-ci
              lit tout l'historique, les chiffres du haut 14 jours. */}
          <p className="dash-period">Sur tout ton historique.</p>
          {!ready ? (
            <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>Chargement…</p>
          ) : (
            <Lecture
              tasks={tasks}
              joursRenseignes={d.joursRenseignes}
              joursAvecPlan={d.joursAvecPlan}
              horsPlan={d.horsPlanTotal}
              reel={d.reelTotal}
              causes={d.causes}
            />
          )}
        </section>

        <section className="card-surface" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h2 className="section-title">
            Tes derniers débriefs
          </h2>
          <p className="dash-period">Les six plus récents.</p>
          {!ready ? (
            <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>Chargement…</p>
          ) : debriefs.length === 0 ? (
            <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>
              Aucun débrief pour l&apos;instant.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              {[...debriefs]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 6)
                .map((e) => (
                  // Humeur et début de la note : « Objectifs atteints » répété
                  // sur chaque ligne ne disait rien.
                  <div key={e.date} className="dash-debrief">
                    <span className="dash-debrief-date">{prettyDate(e.date)}</span>
                    <span className="dash-debrief-note">
                      {e.missingNote?.trim() || (e.reachedGoals ? "Objectifs atteints." : "Objectifs en partie atteints.")}
                    </span>
                    {e.mood && (
                      <span className="dash-debrief-mood" title={MOODS.find((m) => m.valeur === e.mood)?.label}>
                        <Visage courbe={MOODS.find((m) => m.valeur === e.mood)?.courbe ?? 0} />
                        {MOODS.find((m) => m.valeur === e.mood)?.court}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Chiffre({
  valeur,
  libelle,
  couleur,
  aide,
}: {
  valeur: string;
  libelle: string;
  couleur?: string;
  aide: string;
}) {
  return (
    <div className="card-surface" style={{ padding: "1.2rem 1.3rem" }}>
      <div className="stat-value" style={{ color: couleur ?? "var(--text)" }}>
        {valeur}
      </div>
      <div style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>{libelle}</div>
      <div style={{ fontSize: "0.72rem", color: "var(--text-mute)", marginTop: 4 }}>{aide}</div>
    </div>
  );
}

/**
 * Deux barres par jour : ce qui était prévu, ce qui a été fait.
 * Toutes les barres partagent la même échelle, sinon comparer deux
 * journées n'aurait aucun sens.
 */
function Graphique({ jours }: { jours: Jour[] }) {
  const max = Math.max(...jours.map((j) => Math.max(j.prevu, j.reel)), 60);
  const H = 130;

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {/* Une échelle, même minimale : sans repère, la hauteur d'une
          barre ne se traduit en durée qu'au survol. */}
      <div
        style={{
          height: H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontSize: "0.65rem",
          color: "var(--text-mute)",
          flexShrink: 0,
        }}
      >
        <span>{formatDuration(max)}</span>
        <span>0</span>
      </div>

    <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 4, height: H + 34 }}>
      {jours.map((j) => (
        <div
          key={j.date}
          title={`${j.date} — prévu ${formatDuration(j.prevu)}, ${j.renseigne ? `réalisé ${formatDuration(j.reel)}` : "non renseigné"}`}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: H, width: "100%" }}>
            <Barre hauteur={(j.prevu / max) * H} couleur="var(--color-plan)" opacite={0.7} />
            {/* Un jour planifié sans aucun temps noté n'a pas un réel nul :
                il a un réel inconnu. Un contour vide le dit, une barre à
                zéro le ferait passer pour une journée ratée. */}
            {j.renseigne ? (
              <Barre hauteur={(j.reel / max) * H} couleur="var(--color-brand)" opacite={0.95} />
            ) : j.prevu > 0 ? (
              <div
                style={{
                  flex: 1,
                  /* Hauteur fixe et minime : le réel est inconnu, pas égal
                     au prévu. Reprendre la hauteur prévue affirmerait une
                     valeur que personne n'a saisie. */
                  height: 10,
                  border: "1px dashed var(--color-slate)",
                  borderRadius: 3,
                  opacity: 0.7,
                }}
              />
            ) : (
              /* Rien de planifié ce jour-là : pas de trait du tout. Une
                 hauteur nulle laissait quand même apparaître les deux
                 bordures, ce qui faisait passer un jour vide pour un jour
                 planifié non renseigné. */
              <span style={{ flex: 1 }} />
            )}
          </div>
          <span
            style={{
              fontSize: "0.62rem",
              color: j.renseigne ? "var(--text-soft)" : "var(--text-mute)",
              whiteSpace: "nowrap",
            }}
          >
            {j.date.slice(8)}
          </span>
        </div>
      ))}
    </div>
    </div>
  );
}

function Barre({ hauteur, couleur, opacite }: { hauteur: number; couleur: string; opacite: number }) {
  return (
    <div
      style={{
        flex: 1,
        height: Math.max(hauteur, hauteur > 0 ? 3 : 0),
        background: couleur,
        opacity: opacite,
        borderRadius: "6px 6px 0 0",
        minHeight: 0,
      }}
    />
  );
}

/**
 * La lecture des données.
 *
 * Chaque phrase indique sur quoi elle repose. En dessous d'un certain
 * volume, on dit qu'on ne sait pas encore — une tendance annoncée sur
 * trois mesures est une invention, pas un insight.
 */
function Lecture({
  tasks,
  joursRenseignes,
  joursAvecPlan,
  horsPlan,
  reel,
  causes,
}: {
  tasks: Task[];
  joursRenseignes: number;
  joursAvecPlan: number;
  horsPlan: number;
  reel: number;
  causes: { label: string; n: number }[];
}) {
  // Voir lib/lecture.ts : un rapport proche de 1 ne prouve pas que les
  // estimations sont justes, il peut venir d'un temps réel recopié.
  const lignes: string[] = [estimationReading(tasks)];

  if (joursAvecPlan > 0) {
    lignes.push(
      `Ces ${FENETRE} derniers jours : ${joursRenseignes} jour${joursRenseignes > 1 ? "s" : ""} renseigné${joursRenseignes > 1 ? "s" : ""} sur ${joursAvecPlan} jour${joursAvecPlan > 1 ? "s" : ""} planifié${joursAvecPlan > 1 ? "s" : ""}.`
    );
  }

  if (horsPlan > 0 && reel > 0) {
    lignes.push(
      `Ces ${FENETRE} derniers jours, ${Math.round((horsPlan / reel) * 100)} % de ton temps noté n'était pas planifié.`
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.7rem" }}>
      {lignes.map((l, i) => (
        <p key={i} style={{ fontSize: "0.9rem", color: "var(--text-soft)" }}>
          {l}
        </p>
      ))}

      {causes.length > 0 && (
        <div style={{ marginTop: "0.4rem" }}>
          <p style={{ fontSize: "0.8rem", color: "var(--text-mute)", marginBottom: 6 }}>
            Causes d&apos;écart déclarées, depuis le début
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {causes.map((c) => (
              <span key={c.label} className="chip">
                {c.label} · {c.n}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
