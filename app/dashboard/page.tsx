"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task, DebriefEntry } from "@/lib/types";
import { repo } from "@/lib/repo";
import { useWeather } from "@/lib/useWeather";
import NavBar from "@/components/NavBar";

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [debriefs, setDebriefs] = useState<DebriefEntry[]>([]);
  const [ready, setReady] = useState(false);
  const { weather, status, load: loadWeather } = useWeather();

  // Chargement post-montage : les données arrivent après hydratation.
  useEffect(() => {
    void (async () => {
      try {
        const [allTasks, allDebriefs] = await Promise.all([
          repo.tasks.all(),
          repo.debriefs.all(),
        ]);
        // exclure les archivées des statistiques (elles ne comptent plus)
        setTasks(allTasks.filter((t) => !t.archived));
        setDebriefs(allDebriefs);
      } catch (e) {
        console.error("Chargement du tableau de bord impossible", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const g = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const missed = tasks.filter((t) => t.status === "missed").length;
    const rate = total ? Math.round((done / total) * 100) : 0;
    // regrouper par jour pour la mini-courbe (7 derniers jours actifs)
    const byDay: Record<string, { total: number; done: number }> = {};
    tasks.forEach((t) => {
      byDay[t.date] ??= { total: 0, done: 0 };
      byDay[t.date].total++;
      if (t.status === "done") byDay[t.date].done++;
    });
    const days = Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, v]) => ({ date, rate: v.total ? Math.round((v.done / v.total) * 100) : 0 }));
    return { total, done, missed, rate, days, activeDays: Object.keys(byDay).length };
  }, [tasks]);

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700, marginBottom: "0.35rem" }}>
          Tableau de bord
        </h1>
        <p style={{ color: "var(--text-soft)", fontSize: "0.92rem", marginBottom: "1.75rem" }}>
          Ta vue d&apos;ensemble, tous jours confondus.
        </p>

        {/* Cartes de stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <BigStat label="Objectifs créés" value={ready ? g.total : "—"} />
          <BigStat label="Réussis" value={ready ? g.done : "—"} color="var(--color-mint)" />
          <BigStat label="Manqués" value={ready ? g.missed : "—"} color="var(--color-rose)" />
          <BigStat label="Taux de réussite" value={ready ? `${g.rate}%` : "—"} color="var(--color-brand)" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
          {/* Courbe de réussite */}
          <section className="card-surface" style={{ padding: "1.4rem" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 600, marginBottom: "1.2rem" }}>
              Réussite des derniers jours
            </h2>
            {!ready ? (
              <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>Chargement…</p>
            ) : g.days.length === 0 ? (
              <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>Pas encore de données. Planifie et termine des objectifs pour voir ta progression.</p>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140 }}>
                {g.days.map((d) => (
                  <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ width: "100%", display: "flex", alignItems: "flex-end", height: 100 }}>
                      <div
                        style={{
                          width: "100%",
                          height: `${Math.max(4, d.rate)}%`,
                          background: "var(--color-brand)",
                          borderRadius: "6px 6px 0 0",
                          transition: "height 0.5s cubic-bezier(0.22,1,0.36,1)",
                          opacity: 0.85,
                        }}
                        title={`${d.rate}%`}
                      />
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-mute)" }}>{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Météo (idée du sujet d'examen) */}
          <section className="card-surface" style={{ padding: "1.4rem" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 600, marginBottom: "0.9rem" }}>
              Météo du moment
            </h2>
            {status === "ok" && weather ? (
              <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", fontWeight: 700, color: "var(--color-amber)" }}>
                  {weather.temp}°
                </span>
                <div>
                  <p style={{ fontWeight: 600 }}>{weather.label}</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>Un coup d&apos;œil avant de planifier ta journée.</p>
                </div>
              </div>
            ) : status === "loading" ? (
              <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>Localisation en cours…</p>
            ) : status === "denied" ? (
              <div>
                <p style={{ color: "var(--text-soft)", fontSize: "0.88rem", marginBottom: "0.8rem", lineHeight: 1.5 }}>
                  Localisation refusée. Pour voir la météo, autorise l&apos;accès à ta position dans les réglages de ton navigateur, puis réessaie.
                </p>
                <button className="btn-ghost" onClick={loadWeather}>Réessayer</button>
              </div>
            ) : (
              <div>
                <p style={{ color: "var(--text-soft)", fontSize: "0.88rem", marginBottom: "0.9rem", lineHeight: 1.5 }}>
                  Affiche la température locale pour t&apos;aider à planifier. Ta position sert uniquement à ça — rien n&apos;est enregistré.
                </p>
                <button className="btn-primary" onClick={loadWeather}>Voir la météo</button>
              </div>
            )}
          </section>

          {/* Journal des débriefs */}
          <section className="card-surface" style={{ padding: "1.4rem" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 600, marginBottom: "0.9rem" }}>
              Tes derniers débriefs
            </h2>
            {!ready ? (
              <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>Chargement…</p>
            ) : debriefs.length === 0 ? (
              <p style={{ color: "var(--text-mute)", fontSize: "0.9rem" }}>Aucun débrief pour l&apos;instant. Fais le point en fin de journée depuis « Ma journée ».</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {debriefs.slice(-5).reverse().map((d) => (
                  <div key={d.date} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.6rem 0", borderBottom: "1px solid var(--border)", fontSize: "0.88rem" }}>
                    <span style={{ color: "var(--text-soft)" }}>{d.date}</span>
                    <span>{["😔","😕","😐","🙂","😄"][(d.mood ?? 3) - 1]} {d.reachedGoals ? "Objectifs atteints" : "Partiellement"}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function BigStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card-surface" style={{ padding: "1.2rem" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700, color: color ?? "var(--text)" }}>{value}</div>
      <div style={{ fontSize: "0.8rem", color: "var(--text-mute)", marginTop: 2 }}>{label}</div>
    </div>
  );
}