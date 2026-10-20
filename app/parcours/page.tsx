"use client";

import { useState } from "react";
import Link from "next/link";
import type { Goal, GoalStatus, Task } from "@/lib/types";
import { useGoals } from "@/lib/useGoals";
import { useAllTasks } from "@/lib/useAllTasks";
import { summarize, plural, consacre, lastSessionLabel } from "@/lib/portfolio";
import { prettyDate, formatDuration, todayISO } from "@/lib/time";
import NavBar from "@/components/NavBar";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { LIMITS } from "@/lib/limits";
import CharCount from "@/components/CharCount";

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
  // Les séances, pour dire sur chaque ligne ce qui s'y passe. En lecture
  // seule : un échec de chargement retire seulement ces chiffres.
  const { tasks, ready: tasksReady } = useAllTasks();
  // La création se fait dans une fenêtre, comme celle d'un objectif : la
  // page reste celle de la liste, qu'on vient consulter bien plus souvent.
  const [creating, setCreating] = useState(false);

  const actifs = goals.filter((g) => g.status === "active");
  const archives = goals.filter((g) => g.status !== "active");

  return (
    <>
      <NavBar />
      <main className="page-shell" style={{ paddingTop: "1.5rem", paddingBottom: "4rem" }}>
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
          action={
            ready ? (
              <button className="btn-hero" onClick={() => setCreating(true)}>+ Nouveau parcours</button>
            ) : undefined
          }
        />

        {/* Fenêtre de création. Son bouton est plein, pas en dégradé :
            celui de l'en-tête reste visible derrière, et il ne doit y en
            avoir qu'un. Elle se ferme après une création réussie ; ratée,
            elle reste ouverte avec la saisie. */}
        <Modal open={creating} title="Nouveau parcours" onClose={() => setCreating(false)}>
          <GoalForm
            initial={EMPTY}
            submitLabel="Créer le parcours"
            autoFocus
            onCancel={() => setCreating(false)}
            onSubmit={async (d) => {
              const ok = await addGoal(toGoalFields(d));
              if (ok) setCreating(false);
              return ok;
            }}
          />
        </Modal>

        <h2 className="parcours-section-title">En cours</h2>
        {!ready ? (
          <p className="parcours-empty">Chargement…</p>
        ) : actifs.length === 0 ? (
          <p className="parcours-empty">
            {goals.length === 0
              ? "Aucun parcours pour l'instant. Crée le premier avec « + Nouveau parcours » : il apparaîtra ensuite dans le formulaire de chaque objectif."
              : "Aucun parcours en cours : ils sont tous archivés ci-dessous."}
          </p>
        ) : (
          <div className="parcours-list">
            {actifs.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                tasks={tasksReady ? tasks : undefined}
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
                  tasks={tasksReady ? tasks : undefined}
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
  autoFocus = false,
}: {
  initial: Draft;
  submitLabel: string;
  /** Bouton principal de l'écran : dégradé et halo. Un seul par écran,
   *  donc pas pour le formulaire de modification. */
  hero?: boolean;
  /** Curseur dans le premier champ à l'ouverture (fenêtre de création). */
  autoFocus?: boolean;
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
    if (ok !== false) setDraft(initial === EMPTY ? EMPTY : draft);
  };

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <div>
        <label className="field-label">Nom du parcours</label>
        <input
          className="field"
          autoFocus={autoFocus}
          value={draft.title}
          maxLength={LIMITS.goalTitle}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ex. : Certification Power BI PL-300"
        />
        <CharCount value={draft.title} max={LIMITS.goalTitle} />
      </div>
      <div>
        <label className="field-label">Pourquoi ce parcours ? (optionnel)</label>
        <textarea
          className="field"
          rows={2}
          value={draft.why}
          maxLength={LIMITS.why}
          onChange={(e) => set("why", e.target.value)}
          placeholder="Ex. : pour postuler aux offres de data analyst."
          style={{ resize: "vertical" }}
        />
        <CharCount value={draft.why} max={LIMITS.why} />
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
      {error && <p style={{ color: "var(--color-rose-text)", fontSize: "0.85rem" }}>{error}</p>}
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
  tasks,
  editing,
  onEdit,
  onCancelEdit,
  onSave,
  onStatus,
}: {
  goal: Goal;
  /** Toutes les séances, une fois chargées. */
  tasks?: Task[];
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
  const s = tasks ? summarize(goal, tasks) : null;

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
        {/* Ce qui s'y passe, en une ligne : les mêmes chiffres que le
            portfolio, avec le même vocabulaire (« consacrées »). */}
        {s && (
          <p className="parcours-facts">
            {s.sessions.length === 0 ? (
              "Aucune séance pour l'instant."
            ) : (
              <>
                <strong>{formatDuration(s.minutes)}</strong> {consacre(s.minutes)} ·{" "}
                {plural(s.sessions.length, "séance", "séances")} · dernière séance{" "}
                {lastSessionLabel(s.lastDate!, todayISO())}
                {" · "}
                <Link href={`/portfolio/${goal.id}`} className="parcours-link">Voir dans le portfolio</Link>
              </>
            )}
          </p>
        )}
      </div>

      {/* Trois actions du même poids, en texte : aucune n'est plus
          importante que les autres, et une pilule sur une seule
          ajoutait du bruit à chaque ligne. */}
      <div className="row-actions">
        {actif ? (
          <>
            <button className="row-action" onClick={onEdit}>Modifier</button>
            <button className="row-action" onClick={() => onStatus("paused")}>Mettre en pause</button>
            <button className="row-action" onClick={() => onStatus("done")}>Marquer terminé</button>
          </>
        ) : (
          <button className="row-action" onClick={() => onStatus("active")}>Réactiver</button>
        )}
      </div>
    </article>
  );
}
