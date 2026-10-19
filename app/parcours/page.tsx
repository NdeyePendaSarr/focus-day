"use client";

import { useState } from "react";
import type { Goal, GoalStatus } from "@/lib/types";
import { useGoals } from "@/lib/useGoals";
import { prettyDate } from "@/lib/time";
import NavBar from "@/components/NavBar";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/PageHeader";

const STATUS_LABEL: Record<GoalStatus, string> = {
  active: "En cours",
  paused: "En pause",
  done: "Terminé",
  // Jamais proposé dans l'interface, mais la base l'accepte : un parcours
  // marqué ainsi ailleurs doit rester lisible, sans le mot « abandon ».
  abandoned: "Arrêté",
};

type Draft = { title: string; why: string; targetDate: string };
const EMPTY: Draft = { title: "", why: "", targetDate: "" };

export default function ParcoursPage() {
  const { goals, ready, loadError, writeFailures, dismissWriteFailure, refresh, addGoal, updateGoal } = useGoals();
  const [editingId, setEditingId] = useState<string | null>(null);

  const actifs = goals.filter((g) => g.status === "active");
  const archives = goals.filter((g) => g.status !== "active");

  return (
    <>
      <NavBar />
      <main className="page-shell" style={{ padding: "1.5rem 1.25rem 4rem" }}>
        {(loadError || writeFailures.length > 0) && (
          <div style={{ display: "grid", gap: 8, marginBottom: "1.25rem" }}>
            {loadError && (
              <ErrorBanner
                message="Tes parcours n'ont pas pu être chargés depuis le serveur. Ce qui s'affiche n'est peut-être pas ce qui est enregistré."
                detail={loadError}
                actionLabel="Réessayer"
                onAction={() => void refresh()}
              />
            )}
            {writeFailures.map((f) => (
              <ErrorBanner
                key={f.id}
                message={f.message}
                detail={f.detail}
                actionLabel="J'ai compris"
                onAction={() => dismissWriteFailure(f.id)}
              />
            ))}
          </div>
        )}

        <PageHeader
          eyebrow="Parcours"
          before="Ce que tu"
          accent="apprends"
          sub="Une formation, une certification, un projet. Rattache-y tes objectifs du jour pour garder la trace de ce que tu y as consacré."
        />

        <section className="card-surface" style={{ padding: "1.5rem", marginBottom: "2rem", maxWidth: 640 }}>
          <h2 className="parcours-section-title" style={{ marginBottom: "0.8rem" }}>Nouveau parcours</h2>
          <GoalForm
            initial={EMPTY}
            submitLabel="Créer le parcours"
            hero
            onSubmit={(d) => addGoal(toGoalFields(d))}
          />
        </section>

        <h2 className="parcours-section-title">En cours</h2>
        {!ready ? (
          <p className="parcours-empty">Chargement…</p>
        ) : actifs.length === 0 ? (
          <p className="parcours-empty">
            Aucun parcours en cours. Crée le premier ci-dessus : il apparaîtra
            ensuite dans le formulaire de chaque objectif.
          </p>
        ) : (
          <div className="parcours-list">
            {actifs.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                editing={editingId === g.id}
                onEdit={() => setEditingId(g.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(d) => {
                  setEditingId(null);
                  void updateGoal(g, toGoalFields(d));
                }}
                onStatus={(status) => void updateGoal(g, { status })}
              />
            ))}
          </div>
        )}

        {archives.length > 0 && (
          <>
            <h2 className="parcours-section-title" style={{ marginTop: "2rem" }}>Archivés</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-mute)", marginBottom: "0.75rem" }}>
              Ils ne sont plus proposés dans le formulaire des objectifs. Leurs
              sessions restent dans l&apos;historique.
            </p>
            <div className="parcours-list">
              {archives.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  editing={false}
                  onStatus={(status) => void updateGoal(g, { status })}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */

function toGoalFields(d: Draft): Pick<Goal, "title" | "why" | "targetDate"> {
  return {
    title: d.title.trim(),
    why: d.why.trim() || undefined,
    targetDate: d.targetDate || undefined,
  };
}

function GoalForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  hero = false,
}: {
  initial: Draft;
  submitLabel: string;
  /** Bouton principal de l'écran : dégradé et halo. Un seul par écran,
   *  donc pas pour le formulaire de modification. */
  hero?: boolean;
  /** false = écriture ratée : la saisie est conservée. */
  onSubmit: (d: Draft) => void | Promise<boolean>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    if (!draft.title.trim()) return setError("Donne un nom à ton parcours.");
    setError(null);
    setPending(true);
    const ok = await onSubmit(draft);
    setPending(false);
    // Création réussie : le formulaire se vide. Ratée : il garde la saisie.
    if (!onCancel && ok !== false) setDraft(EMPTY);
  };

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <div>
        <label className="field-label">Nom du parcours</label>
        <input
          className="field"
          value={draft.title}
          maxLength={200}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Certification Power BI PL-300"
        />
      </div>
      <div>
        <label className="field-label">Pourquoi ce parcours ? (optionnel)</label>
        <textarea
          className="field"
          rows={2}
          value={draft.why}
          maxLength={1000}
          onChange={(e) => set("why", e.target.value)}
          placeholder="Pour pouvoir postuler aux offres de data analyst."
          style={{ resize: "vertical" }}
        />
      </div>
      <div>
        <label className="field-label">Échéance visée (optionnel)</label>
        <input
          type="date"
          className="field"
          value={draft.targetDate}
          onChange={(e) => set("targetDate", e.target.value)}
          style={{ maxWidth: 200 }}
        />
      </div>
      {error && <p style={{ color: "var(--color-rose)", fontSize: "0.85rem" }}>{error}</p>}
      <div style={{ display: "flex", gap: "0.7rem", justifyContent: "flex-end" }}>
        {onCancel && <button className="btn-ghost" onClick={onCancel}>Annuler</button>}
        <button className={hero ? "btn-hero" : "btn-primary"} onClick={() => void submit()} disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  editing,
  onEdit,
  onCancelEdit,
  onSave,
  onStatus,
}: {
  goal: Goal;
  editing: boolean;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSave?: (d: Draft) => void;
  onStatus: (s: GoalStatus) => void;
}) {
  if (editing && onSave && onCancelEdit) {
    return (
      <article className="card-surface" style={{ padding: "1rem 1.15rem" }}>
        <GoalForm
          initial={{ title: goal.title, why: goal.why ?? "", targetDate: goal.targetDate ?? "" }}
          submitLabel="Enregistrer"
          onSubmit={onSave}
          onCancel={onCancelEdit}
        />
      </article>
    );
  }

  const actif = goal.status === "active";

  return (
    <article className="card-surface parcours-card">
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 600, overflowWrap: "anywhere" }}>
            {goal.title}
          </h3>
          {!actif && <span className="goal-tag">{STATUS_LABEL[goal.status]}</span>}
        </div>
        {goal.why && (
          <p style={{ fontSize: "0.82rem", color: "var(--text-soft)", fontStyle: "italic", marginTop: 4 }}>
            {goal.why}
          </p>
        )}
        {/* Une échéance passée n'est pas signalée comme un retard : elle
            décrit une intention, elle ne note pas. */}
        {goal.targetDate && (
          <p style={{ fontSize: "0.78rem", color: "var(--text-mute)", marginTop: 6 }}>
            Échéance visée : {prettyDate(goal.targetDate)}
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {actif ? (
          <>
            <button className="chip chip-quiet" onClick={onEdit}>Modifier</button>
            <button className="chip chip-quiet" onClick={() => onStatus("paused")}>Mettre en pause</button>
            <button className="chip chip-mint" onClick={() => onStatus("done")}>Marquer terminé</button>
          </>
        ) : (
          <button className="chip" onClick={() => onStatus("active")}>Réactiver</button>
        )}
      </div>
    </article>
  );
}
