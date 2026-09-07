"use client";

import { useState } from "react";
import type { Task, DebriefEntry } from "@/lib/types";
import { repo } from "@/lib/repo";

import type { GapReason } from "@/lib/types";
import DayCatchUp from "@/components/DayCatchUp";

/**
 * Débriefing du soir : le moment réflexif qui distingue FocusDay
 * d'une todo-list. On confronte le ressenti aux faits de la journée.
 */
export default function EveningDebrief({
  date,
  tasks,
  existing,
  onSaved,
  onSetActual,
  onAddUnplanned,
}: {
  date: string;
  tasks: Task[];
  existing?: DebriefEntry;
  onSaved: () => void;
  onSetActual: (id: string, actualMinutes: number, gapReason?: GapReason) => void;
  onAddUnplanned: (name: string, minutes: number) => void;
}) {
  const planned = tasks.filter((t) => t.origin !== "unplanned");
  const done = planned.filter((t) => t.status === "done").length;
  const sansTempsReel = planned.filter((t) => t.actualMinutes == null).length;
  const [reached, setReached] = useState<boolean | null>(existing?.reachedGoals ?? null);
  const [didMore, setDidMore] = useState<boolean>(existing?.didMore ?? false);
  const [note, setNote] = useState(existing?.missingNote ?? "");
  const [mood, setMood] = useState<number>(existing?.mood ?? 3);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const entry: DebriefEntry = {
      date,
      reachedGoals: reached ?? false,
      didMore,
      missingNote: note.trim() || undefined,
      mood: mood as DebriefEntry["mood"],
      createdAt: new Date().toISOString(),
    };
    setSaving(true);
    try {
      await repo.debriefs.save(entry);
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-surface" style={{ padding: "1.4rem" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700, marginBottom: 4 }}>
        Débrief du soir
      </h2>
      <p style={{ fontSize: "0.88rem", color: "var(--text-soft)", marginBottom: "1.3rem" }}>
        {resume(planned.length, done, sansTempsReel)}
      </p>

      {/* Les faits d'abord, le ressenti ensuite : répondre "oui, tout va
          bien" est plus difficile après avoir écrit ses vrais chiffres. */}
      <div className="debrief-grid">
        <div>
          <DayCatchUp tasks={tasks} onSetActual={onSetActual} onAddUnplanned={onAddUnplanned} />
        </div>

        <div style={{ display: "grid", gap: "1.2rem" }}>
        <div>
          <label className="field-label">As-tu atteint tes objectifs du jour ?</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={reached === true ? "btn-primary" : "btn-ghost"} onClick={() => setReached(true)} style={{ flex: 1 }}>Oui</button>
            <button className={reached === false ? "btn-primary" : "btn-ghost"} onClick={() => setReached(false)} style={{ flex: 1 }}>Pas tout à fait</button>
          </div>
        </div>

        <div>
          <label className="field-label">As-tu fait plus que prévu ?</label>
          <button className={didMore ? "btn-primary" : "btn-ghost"} onClick={() => setDidMore((v) => !v)}>
            {didMore ? "Oui, j'ai fait plus ✓" : "Non, m'en tenir au plan"}
          </button>
        </div>

        <div>
          <label className="field-label">Qu&apos;est-ce qui a manqué, ou que tu as ajouté ?</label>
          <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="J'ai reporté la lecture, mais j'ai avancé sur le projet…" style={{ resize: "vertical" }} />
        </div>

        <div>
          <label className="field-label">Ta journée, dans l&apos;ensemble</label>
          <div style={{ display: "flex", gap: 6 }}>
            {MOODS.map((m) => (
              <button
                key={m.valeur}
                onClick={() => setMood(m.valeur)}
                aria-label={m.label}
                title={m.label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "0.55rem 0.3rem",
                  borderRadius: 10,
                  border: `1px solid ${mood === m.valeur ? "var(--color-brand)" : "var(--border)"}`,
                  background: mood === m.valeur ? "var(--bg-3)" : "transparent",
                  color: mood === m.valeur ? "var(--color-brand)" : "var(--text-mute)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <Visage courbe={m.courbe} />
                <span style={{ fontSize: "0.62rem", fontWeight: 600 }}>{m.court}</span>
              </button>
            ))}
          </div>
        </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "flex-end" }}>
            {saved && <span style={{ color: "var(--color-mint)", fontSize: "0.85rem" }}>Débrief enregistré ✓</span>}
            <button className="btn-primary" onClick={save} disabled={reached === null || saving}>
              {saving ? "Enregistrement…" : "Enregistrer mon débrief"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * L'accroche du débrief.
 *
 * Elle décrit la journée, elle ne la note pas. Un pourcentage de
 * réussite félicite ou accuse selon le chiffre, alors qu'un objectif
 * non terminé peut venir d'une mauvaise estimation, d'un imprévu ou
 * d'un changement de priorité — c'est justement ce que le débrief
 * cherche à faire dire. Autant ne pas trancher avant de demander.
 */
function resume(total: number, done: number, sansTempsReel: number): string {
  if (total === 0) return "Rien n'était planifié aujourd'hui. Note ce que tu as fait quand même.";

  const objectifs = total > 1 ? "objectifs prévus" : "objectif prévu";
  const bilan =
    done === 0 ? "aucun terminé" : done === total ? "tous terminés" : `${done} terminé${done > 1 ? "s" : ""}`;

  const suite =
    sansTempsReel > 0
      ? ` Il manque le temps réel de ${sansTempsReel} d'entre eux.`
      : " Regarde l'écart avant de répondre.";

  return `${total} ${objectifs}, ${bilan}.${suite}`;
}

/**
 * Les émojis système ont été remplacés par des visages dessinés.
 *
 * Un émoji change d'apparence selon la plateforme, s'aligne mal sur la
 * ligne de base et trahit immédiatement un produit non fini. Cinq
 * visages en SVG suivent la couleur du texte et restent identiques
 * partout — et le libellé sous chacun lève l'ambiguïté du dessin.
 */
const MOODS = [
  { valeur: 1, courbe: 7, court: "Dure", label: "Journée difficile" },
  { valeur: 2, courbe: 3, court: "Mitigée", label: "Journée mitigée" },
  { valeur: 3, courbe: 0, court: "Neutre", label: "Journée neutre" },
  { valeur: 4, courbe: -3, court: "Bonne", label: "Bonne journée" },
  { valeur: 5, courbe: -7, court: "Très bonne", label: "Très bonne journée" },
];

/** courbe > 0 : bouche tournée vers le bas. < 0 : sourire. */
function Visage({ courbe }: { courbe: number }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1.05" fill="currentColor" />
      <circle cx="15" cy="10" r="1.05" fill="currentColor" />
      <path
        d={`M8.2 ${15.4 + courbe / 3} Q12 ${15.4 - courbe} 15.8 ${15.4 + courbe / 3}`}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
