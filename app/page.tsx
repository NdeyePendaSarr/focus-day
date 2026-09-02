"use client";

import { useState, useEffect } from "react";
import type { Task, TaskStatus, DebriefEntry } from "@/lib/types";
import { useTasks, useNow } from "@/lib/useTasks";
import { useReminders } from "@/lib/useReminders";
import { todayISO, prettyDate, computeStats, reminderFor, durationMinutes, formatDuration, parseDuration } from "@/lib/time";
import NavBar from "@/components/NavBar";
import DayTimeline from "@/components/DayTimeline";
import TaskCard from "@/components/TaskCard";
import TaskForm, { TaskDraft } from "@/components/TaskForm";
import EveningDebrief from "@/components/EveningDebrief";
import { repo } from "@/lib/repo";

export default function HomePage() {
  const today = todayISO();
  const { tasks, ready, addTask, updateTask, setStatus, completeTask, setActual, addUnplanned, archiveTask } = useTasks(today);
  const now = useNow();
  const { permission, requestPermission } = useReminders(tasks);

  // La date affichée dépend de l'heure réelle : au prerender statique, `today`
  // serait figé au jour du build et différerait du jour de visite → mismatch
  // d'hydratation (React #418). On ne rend la date qu'après le montage client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [debriefKey, setDebriefKey] = useState(0);
  // La lecture du débrief est asynchrone : elle ne peut plus se faire pendant
  // le rendu. On la recharge au montage, au changement de jour, et après un
  // enregistrement (debriefKey est incrémenté par onSaved).
  const [existingDebrief, setExistingDebrief] = useState<DebriefEntry | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        setExistingDebrief(await repo.debriefs.byDate(today));
      } catch {
        // Session absente ou réseau : pas de débrief affiché, pas de crash.
        setExistingDebrief(null);
      }
    })();
  }, [today, debriefKey]);
  // Les hors-plan n'ont pas de créneau : ils ne passent pas dans la timeline
  // et ne comptent pas dans le taux d'achèvement des objectifs planifiés.
  const plannedTasks = tasks.filter((t) => t.origin !== "unplanned");

  // Le débrief s'ouvre seul après 18h ou s'il existe déjà, mais reste
  // atteignable à tout moment : un débrief rattrapé vaut mieux qu'un
  // débrief manqué, et les journées ratées sont celles qui informent.
  const [debriefOpen, setDebriefOpen] = useState(false);
  const showDebrief =
    ready && tasks.length > 0 && (debriefOpen || now >= 18 * 60 || Boolean(existingDebrief));

  const stats = computeStats(plannedTasks);

  // Le hors-plan compte dans le réalisé : c'est du temps vécu, même
  // s'il ne correspond à aucun créneau.
  const minutesPrevues = plannedTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes ?? durationMinutes(t.start, t.end)),
    0
  );
  const minutesRealisees = tasks.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0);
  const activeReminders = plannedTasks
    .map((t) => reminderFor(t, now))
    .filter((m): m is string => Boolean(m));

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t: Task) => { setEditing(t); setFormOpen(true); };

  const handleSubmit = (d: TaskDraft) => {
    // Champ vide ou incompris : on retient la durée du créneau.
    const estimated = parseDuration(d.estimatedMinutes) ?? durationMinutes(d.start, d.end);
    const base = {
      name: d.name,
      description: d.description,
      why: d.why,
      start: d.start,
      end: d.end,
      estimatedMinutes: estimated,
    };
    if (editing) {
      updateTask(editing.id, base);
    } else {
      addTask(base);
    }
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <>
      <NavBar />
      <main className="page-shell" style={{ padding: "1.5rem 1.25rem 4rem" }}>
        {/* Bandeau permission notifications */}
        {permission !== "granted" && ready && (
          <div className="card-surface" style={{ padding: "0.9rem 1.1rem", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.9rem", color: "var(--text-soft)" }}>
              Active les rappels pour être prévenue quand un créneau approche.
            </span>
            <button className="btn-ghost" onClick={requestPermission}>Activer les rappels</button>
          </div>
        )}

        {/* Rappels actifs */}
        {activeReminders.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: "1.25rem" }}>
            {activeReminders.map((msg, i) => (
              <div key={i} style={{ padding: "0.7rem 1rem", borderRadius: 12, background: "color-mix(in srgb, var(--color-amber) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--color-amber) 30%, transparent)", fontSize: "0.88rem", color: "var(--text)" }}>
                ⏳ {msg}
              </div>
            ))}
          </div>
        )}

        <div className="day-layout">
          {/* Rail : identité du jour, chiffres, timeline, action principale */}
          <aside className="day-rail card-surface" style={{ padding: "1.15rem", display: "grid", gap: "1rem" }}>
            <div>
              <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--color-brand)" }}>
                {mounted ? prettyDate(today) : "\u00A0"}
              </p>
              <h1 className="day-title">
                Ta journée
              </h1>
            </div>

            <button className="btn-primary" onClick={openNew}>+ Nouvel objectif</button>

            <div className="day-stats">
              <Stat label="Objectifs" value={stats.total} />
              <Stat label="Terminés" value={stats.done} color="var(--color-mint)" />
            </div>

            {/* Le rapport de temps remplace le taux de réussite : un
                pourcentage note la journée, ces deux durées la décrivent. */}
            {ready && minutesPrevues > 0 && (
              <p style={{ fontSize: "0.85rem", color: "var(--text-soft)", marginTop: "0.4rem" }}>
                <strong style={{ color: "var(--color-mint)" }}>
                  {formatDuration(minutesRealisees)}
                </strong>{" "}
                sur {formatDuration(minutesPrevues)} réalisées
              </p>
            )}

            {/* Dans le rail sur grand écran, où elle fait face aux objectifs. */}
            <div className="timeline-rail">
              {ready && plannedTasks.length > 0 && <DayTimeline tasks={plannedTasks} now={now} />}
            </div>
          </aside>

          {/* Zone de travail */}
          <section className="day-main">
            {ready && tasks.length === 0 && (
              <div className="card-surface" style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 600, marginBottom: 6 }}>
                  Ta journée est une page blanche.
                </p>
                <p style={{ color: "var(--text-soft)", fontSize: "0.9rem", marginBottom: "1.2rem" }}>
                  Ajoute ton premier objectif avec son créneau — et le pourquoi qui te motive.
                </p>
                <button className="btn-primary" onClick={openNew}>+ Nouvel objectif</button>
              </div>
            )}
            {plannedTasks.map((t) => (
              <TaskCard key={t.id} task={t} now={now} onStatus={setStatus}
              onComplete={completeTask} onEdit={openEdit} onArchive={archiveTask} />
            ))}

            {/* Le débrief appartient à la zone de travail : hors du
                <section>, la grille le placerait sous le rail gauche. */}
            {ready && tasks.length > 0 && !showDebrief && (
              <button
                className="btn-ghost"
                style={{ justifySelf: "start", marginTop: "0.6rem" }}
                onClick={() => setDebriefOpen(true)}
              >
                Faire mon débrief maintenant
              </button>
            )}

            {showDebrief && (
              <EveningDebrief
                key={debriefKey}
                date={today}
                tasks={tasks}
                onSetActual={setActual}
                onAddUnplanned={addUnplanned}
                existing={existingDebrief ?? undefined}
                onSaved={() => setDebriefKey((k) => k + 1)}
              />
            )}
          </section>

          {/* Sur mobile, la timeline passe APRÈS les objectifs : elle montre
              les mêmes créneaux que les cartes, en moins détaillé. La placer
              avant coûtait un écran entier avant d'accéder au contenu. */}
          {ready && plannedTasks.length > 0 && (
            <section className="timeline-below card-surface" style={{ padding: "1.15rem" }}>
              <p style={{ fontSize: "0.78rem", color: "var(--text-mute)", marginBottom: "0.75rem" }}>
                Ta journée heure par heure
              </p>
              <DayTimeline tasks={plannedTasks} now={now} />
            </section>
          )}
        </div>
      </main>

      <TaskForm open={formOpen} editing={editing} existingTasks={tasks} onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={handleSubmit} />
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 700, lineHeight: 1.1, color: color ?? "var(--text)" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.74rem", color: "var(--text-mute)" }}>{label}</div>
    </div>
  );
}
