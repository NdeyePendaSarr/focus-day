"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { repo } from "@/lib/repo";
import { prettyDate, durationMinutes, formatDuration } from "@/lib/time";
import NavBar from "@/components/NavBar";
import NoteEditor from "@/components/NoteEditor";
import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import { useGoals } from "@/lib/useGoals";
import { errorDetail } from "@/lib/errors";

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

/**
 * Seuil d'affichage : au-delà, le delta est mis en évidence.
 *
 * Il ne sert PAS à filtrer. Un seuil décide si un écart mérite d'être
 * signalé, pas s'il existe : 1 h 45 au lieu de 2 h reste plus rapide,
 * même si l'écart est trop faible pour être souligné.
 */
const TOLERANCE = 0.15;

type Filtre = "tout" | "depasse" | "rapide" | "sans-mesure";

/** "" = tous, "aucun" = sans parcours, sinon l'id du parcours. */
type FiltreParcours = string;
const SANS_PARCOURS = "aucun";

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
  const [parcours, setParcours] = useState<FiltreParcours>("");
  // Tous les parcours, archivés compris : l'historique doit nommer ceux
  // d'une formation terminée.
  const { goals } = useGoals();
  const goalTitle = useMemo(() => {
    const map = new Map(goals.map((g) => [g.id, g.title]));
    return (id?: string) => (id ? map.get(id) : undefined);
  }, [goals]);
  const [ready, setReady] = useState(false);
  // La note consultée, ou null. L'historique ne permet que la lecture.
  const [noteLue, setNoteLue] = useState<Task | null>(null);

  const reload = async () => {
    try {
      setTasks(await repo.tasks.all());
    } catch (e) {
      console.error("Chargement de l'historique impossible", e);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  /* --- Rattachement par lot ---------------------------------------- */
  // Pour les séances d'avant les parcours. Le choix reste manuel, ligne
  // par ligne : un rattachement par mots-clés laissait 62 h sur 177 dans
  // « Autres ». La recherche sert seulement à trouver les candidates.
  const [lot, setLot] = useState(false);
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [cible, setCible] = useState(""); // "" = détacher
  const [envoi, setEnvoi] = useState(false);
  const [lotOk, setLotOk] = useState<string | null>(null);
  const [lotEchec, setLotEchec] = useState<{ message: string; detail?: string } | null>(null);

  // Changer la recherche ou un filtre vide la sélection : on ne doit
  // jamais rattacher une séance qu'on ne voit plus à l'écran.
  const basculer = (id: string) =>
    setCoches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const fermerLot = () => {
    setLot(false);
    setCoches(new Set());
    setLotOk(null);
  };

  const rattacher = async () => {
    const ids = [...coches];
    if (ids.length === 0) return;
    const titre = goals.find((g) => g.id === cible)?.title;
    setEnvoi(true);
    setLotOk(null);
    setLotEchec(null);
    try {
      // Chemin dédié : ne modifie que goal_id, jamais la ligne entière.
      await repo.tasks.setGoal(ids, cible || null);
      const wanted = new Set(ids);
      setTasks((prev) => prev.map((t) => (wanted.has(t.id) ? { ...t, goalId: cible || undefined } : t)));
      setCoches(new Set());
      setLotOk(
        titre
          ? `${ids.length} ${ids.length < 2 ? "séance rattachée" : "séances rattachées"} à « ${titre} ».`
          : `${ids.length} ${ids.length < 2 ? "séance détachée" : "séances détachées"} de leur parcours.`
      );
    } catch (e) {
      setLotEchec({
        message:
          "Le rattachement n'a pas abouti entièrement. La liste a été rechargée depuis la base : vérifie ce qui a été rattaché avant de recommencer.",
        detail: errorDetail(e),
      });
      await reload();
    } finally {
      setEnvoi(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => {
        if (parcours === "") return true;
        if (parcours === SANS_PARCOURS) return !t.goalId;
        return t.goalId === parcours;
      })
      .filter((t) => {
        if (filtre === "tout") return true;
        if (filtre === "sans-mesure") return t.actualMinutes == null;
        const ref = reference(t);
        if (t.actualMinutes == null || ref === 0) return false;
        if (filtre === "depasse") return t.actualMinutes > ref;
        // Un objectif à zéro minute n'est pas "plus rapide" : il n'a pas
        // été fait. Le classer ici mélangerait deux situations opposées.
        return t.actualMinutes > 0 && t.actualMinutes < ref;
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
  }, [tasks, query, filtre, parcours]);

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
        <PageHeader
          eyebrow="Historique"
          before="Tes journées"
          accent="passées"
          sub="Ce que tu avais prévu, ce que tu as fait, et ce que tu en as noté."
        />

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
            onChange={(e) => { setQuery(e.target.value); setCoches(new Set()); }}
          />
          {/* Absent tant qu'aucun parcours n'existe : un filtre à une
              seule valeur ne filtrerait rien. */}
          {goals.length > 0 && (
            <select
              className="field"
              aria-label="Filtrer par parcours"
              value={parcours}
              onChange={(e) => { setParcours(e.target.value); setCoches(new Set()); }}
              style={{ flex: "0 1 220px", minWidth: 0 }}
            >
              <option value="">Tous les parcours</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
              <option value={SANS_PARCOURS}>Sans parcours</option>
            </select>
          )}
          {goals.length > 0 && !lot && (
            <button className="btn-ghost" onClick={() => setLot(true)}>
              Rattacher à un parcours
            </button>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTRES.map((f) => (
              <button
                key={f.valeur}
                className={filtre === f.valeur ? "btn-primary" : "btn-ghost"}
                onClick={() => { setFiltre(f.valeur); setCoches(new Set()); }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {lotEchec && (
          <div style={{ marginBottom: "1rem" }}>
            <ErrorBanner
              message={lotEchec.message}
              detail={lotEchec.detail}
              actionLabel="J'ai compris"
              onAction={() => setLotEchec(null)}
            />
          </div>
        )}

        {lot && (
          <div className="card-surface lot-bar">
            <p style={{ fontSize: "0.88rem", fontWeight: 600 }}>
              {coches.size} {coches.size < 2 ? "séance cochée" : "séances cochées"}
            </p>
            <button
              className="chip"
              onClick={() =>
                setCoches(
                  coches.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id))
                )
              }
            >
              {coches.size === filtered.length && filtered.length > 0
                ? "Tout décocher"
                : `Tout cocher (${filtered.length} affichées)`}
            </button>
            {/* Tous les parcours, terminés compris : les séances anciennes
                appartiennent souvent à une formation déjà finie. */}
            <select
              className="field"
              aria-label="Parcours cible"
              value={cible}
              onChange={(e) => setCible(e.target.value)}
              style={{ flex: "0 1 240px", minWidth: 0 }}
            >
              <option value="">Aucun parcours (détacher)</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                  {g.status === "done" ? " — terminé" : g.status !== "active" ? " — en pause" : ""}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={() => void rattacher()} disabled={coches.size === 0 || envoi}>
              {envoi
                ? "Enregistrement…"
                : cible
                  ? `Rattacher ${coches.size} ${coches.size < 2 ? "séance" : "séances"}`
                  : `Détacher ${coches.size} ${coches.size < 2 ? "séance" : "séances"}`}
            </button>
            <button className="chip chip-quiet" onClick={fermerLot}>Terminer</button>
            {lotOk && <p className="lot-ok">{lotOk}</p>}
          </div>
        )}

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
                    <Ligne
                      key={t.id}
                      t={t}
                      goalTitle={goalTitle(t.goalId)}
                      onNote={() => setNoteLue(t)}
                      coche={lot ? coches.has(t.id) : undefined}
                      onCoche={() => basculer(t.id)}
                    />
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
          <span style={{ color: "var(--color-plan)" }}>{formatDuration(prevu)}</span>
          <span style={{ color: "var(--text-mute)" }}> prévues · </span>
          <span style={{ color: "var(--color-brand)" }}>{formatDuration(reel)}</span>
          <span style={{ color: "var(--text-mute)" }}> réalisées</span>
        </>
      )}
    </span>
  );
}

function Ligne({
  t,
  goalTitle,
  onNote,
  coche,
  onCoche,
}: {
  t: Task;
  goalTitle?: string;
  onNote: () => void;
  /** undefined = hors du mode « rattacher » : pas de case. */
  coche?: boolean;
  onCoche: () => void;
}) {
  const horsPlan = t.origin === "unplanned";

  return (
    <div className="hist-row card-surface" style={coche ? { borderColor: "var(--color-brand)" } : undefined}>
      {coche !== undefined && (
        <input
          type="checkbox"
          className="lot-check"
          checked={coche}
          onChange={onCoche}
          aria-label={`Cocher « ${t.name} »`}
        />
      )}
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
              color: t.status === "done" ? "var(--text-soft)" : "var(--text)",
            }}
          >
            {t.name}
          </h3>
          {goalTitle && (
            <span className="goal-tag" title={`Parcours : ${goalTitle}`} style={{ maxWidth: 220 }}>
              {goalTitle}
            </span>
          )}
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
      <span style={{ color: "var(--color-plan)" }}>{formatDuration(ref)}</span>
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
