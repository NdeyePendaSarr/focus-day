"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { repo } from "@/lib/repo";
import { prettyDate, durationMinutes, formatDuration } from "@/lib/time";
import NavBar from "@/components/NavBar";
import NoteEditor from "@/components/NoteEditor";

const STATUS_LABEL: Record<string, string> = {
  planned: "À faire",
  in_progress: "En cours",
  done: "Terminée",
  missed: "Manquée",
};
const STATUS_COLOR: Record<string, string> = {
  planned: "var(--text-mute)",
  in_progress: "var(--color-amber)",
  done: "var(--color-mint)",
  missed: "var(--color-rose)",
};

/** Effort de référence : l'estimation si elle existe, sinon le créneau. */
function reference(t: Task): number {
  if (t.origin === "unplanned") return 0;
  return t.estimatedMinutes ?? durationMinutes(t.start, t.end);
}

/** Au-delà de 15 %, on considère l'écart comme significatif. */
const TOLERANCE = 0.15;

type Filtre = "tout" | "depasse" | "rapide" | "sans-mesure";

const FILTRES: { valeur: Filtre; label: string }[] = [
  { valeur: "tout", label: "Tout" },
  { valeur: "depasse", label: "Dépassé" },
  { valeur: "rapide", label: "Plus rapide" },
  { valeur: "sans-mesure", label: "Sans mesure" },
];

export default function HistoryPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [query, setQuery] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tout");
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
      .filter((t) => {
        if (filtre === "tout") return true;
        if (filtre === "sans-mesure") return t.actualMinutes == null;
        const ref = reference(t);
        if (t.actualMinutes == null || ref === 0) return false;
        const ecart = (t.actualMinutes - ref) / ref;
        return filtre === "depasse" ? ecart > TOLERANCE : ecart < -TOLERANCE;
      })
      .filter(
        (t) =>
          !q ||
          t.name.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          (t.why ?? "").toLowerCase().includes(q) ||
          // Chercher aussi dans les notes : c'est souvent le seul endroit
          // où l'on a écrit ce qui s'est réellement passé.
          (t.note ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  }, [tasks, query, filtre]);

  const byDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    filtered.forEach((t) => {
      (map[t.date] ??= []).push(t);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <>
      <NavBar />
      <main className="page-shell" style={{ padding: "1.5rem 1.25rem 4rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            fontWeight: 700,
            marginBottom: "0.35rem",
          }}
        >
          Historique
        </h1>
        <p
          style={{
            color: "var(--text-soft)",
            fontSize: "0.92rem",
            marginBottom: "1.5rem",
          }}
        >
          Tes journées passées : ce que tu avais prévu, ce que tu as fait, et ce
          que tu en as noté.
        </p>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            marginBottom: "1.5rem",
          }}
        >
          <input
            className="field"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Rechercher dans les objectifs et les notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTRES.map((f) => (
              <button
                key={f.valeur}
                className={filtre === f.valeur ? "btn-primary" : "btn-ghost"}
                onClick={() => setFiltre(f.valeur)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {byDate.length === 0 ? (
          <div
            className="card-surface"
            style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-mute)" }}
          >
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
                <div className="hist-day-head">
                  <h2 className="hist-day-title">{prettyDate(date)}</h2>
                  <ResumeJour items={items} />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {items.map((t) => (
                    <Ligne key={t.id} t={t} onNote={() => setNoteLue(t)} />
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

/* ------------------------------------------------------------------ */

/**
 * Bilan de la journée, à côté de la date.
 *
 * Sans lui, l'historique se relisait comme une liste de titres : on
 * voyait ce qui avait été prévu, jamais ce que la journée avait produit.
 */
function ResumeJour({ items }: { items: Task[] }) {
  const planifies = items.filter((t) => t.origin !== "unplanned");
  const prevu = planifies.reduce((s, t) => s + reference(t), 0);
  const reel = items.reduce((s, t) => s + (t.actualMinutes ?? 0), 0);
  const mesures = planifies.filter((t) => t.actualMinutes != null).length;

  if (prevu === 0 && reel === 0) return null;

  return (
    <span className="hist-day-sum">
      {mesures === 0 ? (
        <span style={{ color: "var(--text-mute)" }}>
          {formatDuration(prevu)} prévues · temps réel non renseigné
        </span>
      ) : (
        <>
          <span style={{ color: "#FFDE21" }}>{formatDuration(prevu)}</span>
          <span style={{ color: "var(--text-mute)" }}> prévues · </span>
          <span style={{ color: "var(--color-brand)" }}>{formatDuration(reel)}</span>
          <span style={{ color: "var(--text-mute)" }}> réalisées</span>
        </>
      )}
    </span>
  );
}

function Ligne({ t, onNote }: { t: Task; onNote: () => void }) {
  const horsPlan = t.origin === "unplanned";

  return (
    <div className="hist-row card-surface">
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: horsPlan ? "var(--color-amber)" : "var(--color-brand)",
              whiteSpace: "nowrap",
            }}
          >
            {horsPlan ? "Hors plan" : `${t.start}–${t.end}`}
          </span>
          <h3
            style={{
              fontSize: "0.98rem",
              fontWeight: 600,
              textDecoration: t.status === "done" ? "line-through" : "none",
              opacity: t.status === "done" ? 0.65 : 1,
            }}
          >
            {t.name}
          </h3>
        </div>

        {t.why && (
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-soft)",
              fontStyle: "italic",
              marginTop: 2,
            }}
          >
            {t.why}
          </p>
        )}

        <Ecart t={t} />
      </div>

      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {t.archived && (
          <span
            style={{
              fontSize: "0.68rem",
              color: "var(--text-mute)",
              padding: "2px 7px",
              borderRadius: 999,
              background: "var(--bg-3)",
            }}
          >
            Archivée
          </span>
        )}

        {t.note && (
          <button
            className="chip chip-icon"
            onClick={onNote}
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

        <span
          style={{ fontSize: "0.74rem", fontWeight: 600, color: STATUS_COLOR[t.status] }}
        >
          ● {STATUS_LABEL[t.status]}
        </span>
      </span>
    </div>
  );
}

/** Le rapport prévu / réel, en une ligne compacte adaptée à une liste dense. */
function Ecart({ t }: { t: Task }) {
  if (t.origin === "unplanned") {
    return (
      <p className="hist-gap" style={{ color: "var(--color-amber)" }}>
        {formatDuration(t.actualMinutes ?? 0)} hors plan
      </p>
    );
  }

  const ref = reference(t);

  if (t.actualMinutes == null) {
    return (
      <p className="hist-gap" style={{ color: "var(--text-mute)" }}>
        {formatDuration(ref)} prévues · temps réel non renseigné
      </p>
    );
  }

  const gap = t.actualMinutes - ref;
  const significatif = ref > 0 && Math.abs(gap) / ref > TOLERANCE;

  return (
    <p className="hist-gap">
      <span style={{ color: "#FFDE21" }}>{formatDuration(ref)}</span>
      <span style={{ color: "var(--text-mute)" }}> prévues · </span>
      <span style={{ color: "var(--color-brand)" }}>
        {formatDuration(t.actualMinutes)}
      </span>
      <span style={{ color: "var(--text-mute)" }}> réalisées</span>
      {significatif && (
        <span
          style={{
            marginLeft: 8,
            fontWeight: 600,
            color: gap > 0 ? "var(--color-amber)" : "var(--text-soft)",
          }}
        >
          {gap > 0 ? "+" : "\u2212"}
          {formatDuration(Math.abs(gap))}
        </span>
      )}
    </p>
  );
}
