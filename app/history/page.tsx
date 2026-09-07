"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { repo } from "@/lib/repo";
import { prettyDate } from "@/lib/time";
import NavBar from "@/components/NavBar";
import NoteEditor from "@/components/NoteEditor";

const STATUS_LABEL: Record<string, string> = {
  planned: "À faire", in_progress: "En cours", done: "Terminée", missed: "Manquée",
};
const STATUS_COLOR: Record<string, string> = {
  planned: "var(--text-mute)", in_progress: "var(--color-amber)", done: "var(--color-mint)", missed: "var(--color-rose)",
};

export default function HistoryPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "done" | "missed">("all");
  const [ready, setReady] = useState(false);
  // La note consultée, ou null. L'historique ne permet que la lecture.
  const [noteLue, setNoteLue] = useState<Task | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setTasks(await repo.tasks.all());
      } catch (e) {
        console.error("Chargement de l'historique impossible", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => (filter === "all" ? true : t.status === filter))
      .filter((t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.why ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  }, [tasks, query, filter]);

  // regrouper par date
  const byDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    filtered.forEach((t) => { (map[t.date] ??= []).push(t); });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700, marginBottom: "0.35rem" }}>
          Historique
        </h1>
        <p style={{ color: "var(--text-soft)", fontSize: "0.92rem", marginBottom: "1.5rem" }}>
          Retrouve tous tes objectifs passés. Disponible même hors connexion.
        </p>

        {/* Recherche + filtres */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          <input className="field" style={{ flex: 1, minWidth: 200 }} placeholder="Rechercher un objectif…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "done", "missed"] as const).map((f) => (
              <button key={f} className={filter === f ? "btn-primary" : "btn-ghost"} onClick={() => setFilter(f)}>
                {f === "all" ? "Tout" : f === "done" ? "Réussis" : "Manqués"}
              </button>
            ))}
          </div>
        </div>

        {byDate.length === 0 ? (
          <div className="card-surface" style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-mute)" }}>
            {!ready
              ? "Chargement…"
              : tasks.length === 0
                ? "Aucun objectif enregistré pour l'instant."
                : "Aucun résultat pour cette recherche."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1.5rem" }}>
            {byDate.map(([date, items]) => (
              <section key={date}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 600, color: "var(--color-brand)", marginBottom: "0.7rem", textTransform: "capitalize" }}>
                  {prettyDate(date)}
                </h2>
                <div style={{ display: "grid", gap: 8 }}>
                  {items.map((t) => (
                    <div key={t.id} className="card-surface" style={{ padding: "0.85rem 1.1rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", fontWeight: 600, color: "var(--color-brand)" }}>{t.start}–{t.end}</span>
                          <h3 style={{ fontSize: "0.98rem", fontWeight: 600, textDecoration: t.status === "done" ? "line-through" : "none", opacity: t.status === "done" ? 0.65 : 1 }}>{t.name}</h3>
                        </div>
                        {t.why && <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", fontStyle: "italic", marginTop: 2 }}>{t.why}</p>}
                      </div>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                        {t.archived && (
                          <span style={{ fontSize: "0.68rem", color: "var(--text-mute)", padding: "2px 7px", borderRadius: 999, background: "var(--bg-3)" }}>
                            Archivée
                          </span>
                        )}
                        {t.note && (
                          <button
                            className="chip chip-icon"
                            onClick={() => setNoteLue(t)}
                            aria-label="Lire la note"
                            title="Lire la note"
                            style={{ color: "var(--color-brand)", borderColor: "var(--color-brand)" }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M4 4.5A1.5 1.5 0 0 1 5.5 3h9L20 8.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-15Z"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinejoin="round"
                                fill="currentColor"
                                fillOpacity={0.14}
                              />
                              <path d="M14 3v5.5h5.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                              <path d="M8 12.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                              <path d="M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                        <span style={{ fontSize: "0.74rem", fontWeight: 600, color: STATUS_COLOR[t.status] }}>
                          ● {STATUS_LABEL[t.status]}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <NoteEditor
        open={noteLue !== null}
        titre={noteLue?.name ?? ""}
        valeur={noteLue?.note ?? ""}
        onClose={() => setNoteLue(null)}
        readOnly
      />
    </>
  );
}