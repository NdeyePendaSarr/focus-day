"use client";

import { useState, useEffect } from "react";
import type { Task, TaskStatus, DebriefEntry } from "@/lib/types";
import { useTasks, useNow } from "@/lib/useTasks";
import { useReminders } from "@/lib/useReminders";
import { todayISO, prettyDate, computeStats, reminderFor } from "@/lib/time";
import NavBar from "@/components/NavBar";
import DayTimeline from "@/components/DayTimeline";
import TaskCard from "@/components/TaskCard";
import TaskForm, { TaskDraft } from "@/components/TaskForm";
import EveningDebrief from "@/components/EveningDebrief";
import { repo } from "@/lib/repo";

export default function HomePage() {
  const today = todayISO();
  const { tasks, ready, addTask, updateTask, setStatus, archiveTask } = useTasks(today);
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
      setExistingDebrief(await repo.debriefs.byDate(today));
    })();
  }, [today, debriefKey]);
  // Le débrief apparaît en fin de journée (après 18h) ou s'il existe déjà
  const showDebrief = ready && tasks.length > 0 && (now >= 18 * 60 || existingDebrief);

  const stats = computeStats(tasks);
  const activeReminders = tasks
    .map((t) => reminderFor(t, now))
    .filter((m): m is string => Boolean(m));

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t: Task) => { setEditing(t); setFormOpen(true); };

  const handleSubmit = (d: TaskDraft) => {
    if (editing) {
      updateTask(editing.id, { name: d.name, description: d.description, why: d.why, start: d.start, end: d.end });
    } else {
      addTask({ name: d.name, description: d.description, why: d.why, start: d.start, end: d.end });
    }
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
        {/* En-tête du jour */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-brand)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {mounted ? prettyDate(today) : "\u00A0"}
            </p>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700, marginTop: 4 }}>
              Ta journée
            </h1>
          </div>
          <button className="btn-primary" onClick={openNew}>+ Nouvel objectif</button>
        </div>

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

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1.5rem" }}>
          {/* Résumé + timeline */}
          <section className="card-surface" style={{ padding: "1.3rem", display: "grid", gap: "1.2rem" }}>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              <Stat label="Objectifs" value={stats.total} />
              <Stat label="Terminés" value={stats.done} color="var(--color-mint)" />
              <Stat label="En cours" value={stats.inProgress} color="var(--color-amber)" />
              <Stat label="Réussite" value={`${stats.successRate}%`} color="var(--color-brand)" />
            </div>
            {ready && tasks.length > 0 && <DayTimeline tasks={tasks} now={now} />}
          </section>

          {/* Liste des tâches */}
          <section style={{ display: "grid", gap: "0.85rem" }}>
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
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} now={now} onStatus={setStatus} onEdit={openEdit} onArchive={archiveTask} />
            ))}
          </section>

          {showDebrief && (
            <EveningDebrief
              key={debriefKey}
              date={today}
              tasks={tasks}
              existing={existingDebrief ?? undefined}
              onSaved={() => setDebriefKey((k) => k + 1)}
            />
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
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 700, color: color ?? "var(--text)" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-mute)" }}>{label}</div>
    </div>
  );
}
