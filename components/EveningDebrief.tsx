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
            {["😔", "😕", "😐", "🙂", "😄"].map((emo, i) => (
              <button
                key={i}
                onClick={() => setMood(i + 1)}
                aria-label={`Humeur ${i + 1} sur 5`}
                style={{
                  flex: 1,
                  fontSize: "1.4rem",
                  padding: "0.5rem",
                  borderRadius: 10,
                  border: `1px solid ${mood === i + 1 ? "var(--color-brand)" : "var(--border)"}`,
                  background: mood === i + 1 ? "var(--bg-3)" : "transparent",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {emo}
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