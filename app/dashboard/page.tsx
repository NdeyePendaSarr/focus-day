"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task, DebriefEntry } from "@/lib/types";
import { GAP_REASONS } from "@/lib/types";
import { repo } from "@/lib/repo";
import { todayISO, shiftISO, durationMinutes, formatDuration } from "@/lib/time";
import NavBar from "@/components/NavBar";

/** Fenêtre d'observation : assez large pour voir une tendance, assez
 *  courte pour que chaque jour reste lisible. */
const FENETRE = 14;

/** En dessous, on ne prétend pas dégager de tendance (voir la hiérarchie
 *  observation / tendance / hypothèse : pas d'insight sans données). */
const MINIMUM_TENDANCE = 5;

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

    // Biais d'estimation : uniquement les tâches où les deux valeurs existent.
    const mesurees = tasks.filter(
      (t) => t.origin !== "unplanned" && t.actualMinutes != null
    );
    const refMesure = mesurees.reduce(
      (s, t) => s + (t.estimatedMinutes ?? durationMinutes(t.start, t.end)),
      0
    );
    const reelMesure = mesurees.reduce((s, t) => s + (t.actualMinutes ?? 0), 0);
    const biais = refMesure > 0 ? reelMesure / refMesure : null;

    // Causes d'écart déclarées
    const causes = GAP_REASONS.map((r) => ({
      label: r.label,
      n: tasks.filter((t) => t.gapReason === r.value).length,
    }))
      .filter((c) => c.n > 0)
      .sort((a, b) => b.n - a.n);

    return {
      jours,
      joursAvecPlan,
      joursRenseignes,
      prevuTotal,
      reelTotal,
      horsPlanTotal,
      biais,
      nMesurees: mesurees.length,
      causes,
    };
  }, [tasks]);

  return (
    <>
      <NavBar />
      <main className="page-shell" style={{ padding: "1.5rem 1.25rem 4rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.9rem",
            fontWeight: 700,
            marginBottom: "0.3rem",
          }}
        >
          Tableau de bord
        </h1>
        <p style={{ color: "var(--text-soft)", fontSize: "0.92rem", marginBottom: "1.75rem" }}>
          Les {FENETRE} derniers jours : ce que tu avais prévu, ce que tu as fait.
        </p>

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
            couleur="var(--color-mint)"
            aide="Sur les mêmes jours, hors-plan compris"
          />
          <Chiffre
            valeur={ready ? formatDuration(d.horsPlanTotal) : "—"}
            libelle="hors plan"
            couleur="var(--color-amber)"
            aide="Fait sans l'avoir prévu"
          />
        </div>

        <section className="card-surface" style={{ padding: "1.3rem", marginTop: "1.25rem" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 600 }}>
            Prévu et réalisé, jour par jour
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-mute)", marginBottom: "1.1rem" }}>
            Barre pleine = temps noté. Contour pointillé = journée planifiée
            dont le temps réel n&apos;a jamais été renseigné. Aucune barre = rien
            de planifié ce jour-là.
          </p>

          {!ready ? (
            <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>Chargement…</p>
          ) : (
            <Graphique jours={d.jours} />
          )}
        </section>

        <section className="card-surface" style={{ padding: "1.3rem", marginTop: "1.25rem" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Ce que les données disent
          </h2>
          {!ready ? (
            <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>Chargement…</p>
          ) : (
            <Lecture
              biais={d.biais}
              nMesurees={d.nMesurees}
              joursRenseignes={d.joursRenseignes}
              joursAvecPlan={d.joursAvecPlan}
              horsPlan={d.horsPlanTotal}
              reel={d.reelTotal}
              causes={d.causes}
            />
          )}
        </section>

        <section className="card-surface" style={{ padding: "1.3rem", marginTop: "1.25rem" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Tes derniers débriefs
          </h2>
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
                  <div
                    key={e.date}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      padding: "0.6rem 0",
                      borderBottom: "1px solid var(--border)",
                      fontSize: "0.88rem",
                    }}
                  >
                    <span style={{ color: "var(--text-soft)" }}>{e.date}</span>
                    <span>{e.reachedGoals ? "Objectifs atteints" : "Partiellement"}</span>
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
    <div className="card-surface" style={{ padding: "1rem 1.1rem" }}>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: couleur ?? "var(--text)",
          lineHeight: 1.15,
        }}
      >
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
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: H + 34 }}>
      {jours.map((j) => (
        <div
          key={j.date}
          title={`${j.date} — prévu ${formatDuration(j.prevu)}, ${j.renseigne ? `réalisé ${formatDuration(j.reel)}` : "non renseigné"}`}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: H, width: "100%" }}>
            <Barre hauteur={(j.prevu / max) * H} couleur="var(--text-mute)" opacite={0.35} />
            {/* Un jour planifié sans aucun temps noté n'a pas un réel nul :
                il a un réel inconnu. Un contour vide le dit, une barre à
                zéro le ferait passer pour une journée ratée. */}
            {j.renseigne ? (
              <Barre hauteur={(j.reel / max) * H} couleur="var(--color-mint)" opacite={0.9} />
            ) : (
              <div
                style={{
                  flex: 1,
                  height: j.prevu > 0 ? (j.prevu / max) * H : 0,
                  border: "1px dashed var(--border)",
                  borderBottom: "none",
                  borderRadius: "4px 4px 0 0",
                }}
              />
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
        borderRadius: "4px 4px 0 0",
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
  biais,
  nMesurees,
  joursRenseignes,
  joursAvecPlan,
  horsPlan,
  reel,
  causes,
}: {
  biais: number | null;
  nMesurees: number;
  joursRenseignes: number;
  joursAvecPlan: number;
  horsPlan: number;
  reel: number;
  causes: { label: string; n: number }[];
}) {
  const lignes: string[] = [];

  if (nMesurees < MINIMUM_TENDANCE || biais === null) {
    lignes.push(
      `${nMesurees} objectif${nMesurees > 1 ? "s" : ""} mesuré${nMesurees > 1 ? "s" : ""} jusqu'ici. Il en faut au moins ${MINIMUM_TENDANCE} pour parler d'une tendance.`
    );
  } else if (biais > 1.15) {
    lignes.push(
      `Tu passes en moyenne ${biais.toFixed(1)}× le temps que tu estimes. Sur ${nMesurees} objectifs mesurés.`
    );
  } else if (biais < 0.85) {
    lignes.push(
      `Tu termines en moyenne en ${Math.round(biais * 100)} % du temps estimé. Tes estimations sont larges.`
    );
  } else {
    lignes.push(`Tes estimations tombent juste, à ${Math.round(Math.abs(1 - biais) * 100)} % près.`);
  }

  if (joursAvecPlan > 0) {
    lignes.push(
      `${joursRenseignes} jour${joursRenseignes > 1 ? "s" : ""} renseigné${joursRenseignes > 1 ? "s" : ""} sur ${joursAvecPlan} jour${joursAvecPlan > 1 ? "s" : ""} planifié${joursAvecPlan > 1 ? "s" : ""}.`
    );
  }

  if (horsPlan > 0 && reel > 0) {
    lignes.push(
      `${Math.round((horsPlan / reel) * 100)} % de ton temps noté n'était pas planifié.`
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
            Causes d&apos;écart déclarées
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