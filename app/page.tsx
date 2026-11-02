"use client";

import { useState, useEffect } from "react";
import type { Task, TaskStatus, DebriefEntry } from "@/lib/types";
import { useTasks, useNow } from "@/lib/useTasks";
import { useGoals } from "@/lib/useGoals";
import { useReminders } from "@/lib/useReminders";
import { todayISO, prettyDate, computeStats, reminderFor, durationMinutes, formatDuration, parseDuration } from "@/lib/time";
import NavBar from "@/components/NavBar";
import DaySummary from "@/components/DaySummary";
import TaskCard from "@/components/TaskCard";
import TaskForm, { TaskDraft } from "@/components/TaskForm";
import EveningDebrief from "@/components/EveningDebrief";
import ErrorBanner from "@/components/ErrorBanner";
import { errorDetail } from "@/lib/errors";
import FirstSteps from "@/components/FirstSteps";
import { repo } from "@/lib/repo";

export default function HomePage() {
  const today = todayISO();
  const { tasks, ready, loadError, writeFailures, dismissWriteFailure, refresh, addTask, updateTask, setStatus, completeTask, setNote, setActual, addUnplanned, archiveTask } = useTasks(today);
  const now = useNow();
  // Une erreur de chargement des parcours n'est pas affichée ici : elle
  // ne prive que du sélecteur et des étiquettes, la page /parcours la
  // signale. Une écriture n'a jamais lieu depuis cette page.
  const { goals, ready: goalsReady } = useGoals();
  const goalTitle = (id?: string) => (id ? goals.find((g) => g.id === id)?.title : undefined);
  const { permission, requestPermission } = useReminders(tasks);

  // La date affichée dépend de l'heure réelle : au prerender statique, `today`
  // serait figé au jour du build et différerait du jour de visite → mismatch
  // d'hydratation (React #418). On ne rend la date qu'après le montage client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Premiers pas : masqués pour de bon une fois les trois étapes faites,
  // ou sur demande. Mémorisé dans ce navigateur seulement — c'est un
  // confort d'affichage, pas une donnée. Lu après le montage (hydratation).
  const PREMIERS_PAS = "focusday.premiers-pas-termines";
  const [stepsHidden, setStepsHidden] = useState(true);
  useEffect(() => {
    try {
      setStepsHidden(localStorage.getItem(PREMIERS_PAS) === "1");
    } catch {
      setStepsHidden(false);
    }
  }, []);
  const showStepsAgain = () => {
    setStepsHidden(false);
    try {
      localStorage.removeItem(PREMIERS_PAS);
    } catch {
      /* stockage indisponible : rien à faire */
    }
  };
  const hideSteps = () => {
    setStepsHidden(true);
    try {
      localStorage.setItem(PREMIERS_PAS, "1");
    } catch {
      /* stockage indisponible : masqué pour cette visite seulement */
    }
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [debriefKey, setDebriefKey] = useState(0);
  // La lecture du débrief est asynchrone : elle ne peut plus se faire pendant
  // le rendu. On la recharge au montage, au changement de jour, et après un
  // enregistrement (debriefKey est incrémenté par onSaved).
  const [existingDebrief, setExistingDebrief] = useState<DebriefEntry | null>(null);
  // Un débrief non chargé s'afficherait vide, et l'enregistrer écraserait
  // celui qui existe déjà en base : l'échec doit se voir.
  const [debriefLoadError, setDebriefLoadError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        setExistingDebrief(await repo.debriefs.byDate(today));
        setDebriefLoadError(null);
      } catch (e) {
        // Session absente ou réseau : pas de crash, mais un bandeau.
        setExistingDebrief(null);
        setDebriefLoadError(errorDetail(e) ?? "erreur inconnue");
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
  // « Fait » sur une séance manquée : ouvrir le débrief, puis amener sa
  // ligne de rattrapage à l'écran, curseur dans la durée.
  const goToCatchUp = (id: string) => {
    setDebriefOpen(true);
    // Le débrief peut ne pas être encore rendu : on attend le prochain
    // affichage avant de chercher la ligne.
    window.setTimeout(() => {
      const row = document.getElementById(`rattrapage-${id}`);
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("catchup-row-focus");
      window.setTimeout(() => row.classList.remove("catchup-row-focus"), 1800);
      document.getElementById(`rattrapage-duree-${id}`)?.focus({ preventScroll: true });
    }, 60);
  };

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
      goalId: d.goalId || undefined,
    };
    if (editing) {
      updateTask(editing.id, base);
    } else {
      addTask(base);
    }
    setFormOpen(false);
    setEditing(null);
  };

  // Journée vide une fois le chargement fini (avant, on n'affiche rien
  // plutôt qu'un état vide qui clignoterait).
  const empty = ready && tasks.length === 0;
  // Pendant le chargement, ni état vide ni chiffres : « 0 objectif » le
  // temps d'une requête serait le constat d'échec qu'on veut éviter.
  const started = ready && tasks.length > 0;
  const linked = tasks.filter((t) => t.goalId);
  const validated = linked.some((t) => t.status === "done" && (t.actualMinutes ?? 0) > 0);
  const stepsDone = goals.length > 0 && linked.length > 0 && validated;
  const showSteps = ready && goalsReady && !stepsHidden && !stepsDone;

  // Les trois étapes faites : on ne les remontre plus.
  useEffect(() => {
    if (!stepsDone) return;
    try {
      localStorage.setItem(PREMIERS_PAS, "1");
    } catch {
      /* stockage indisponible : rien à faire */
    }
  }, [stepsDone]);

  return (
    <>
      <NavBar />
      <main className="page-shell" style={{ paddingTop: "1.5rem", paddingBottom: "4rem" }}>
        {/* Échecs : en tête, avant tout le reste. Une écriture ratée n'est
            pas rejouée — la journée est rechargée et le bandeau dit quoi
            refaire. */}
        {(loadError || debriefLoadError || writeFailures.length > 0) && (
          <div style={{ display: "grid", gap: 8, marginBottom: "1.25rem" }}>
            {loadError && (
              <ErrorBanner
                message="Ta journée n'a pas pu être chargée depuis le serveur. Ce qui s'affiche n'est peut-être pas ce qui est enregistré."
                detail={loadError}
                actionLabel="Réessayer"
                onAction={() => void refresh()}
              />
            )}
            {debriefLoadError && (
              <ErrorBanner
                message="Ton débrief du jour n'a pas pu être chargé. N'en enregistre pas un nouveau avant d'avoir réessayé : il remplacerait l'ancien."
                detail={debriefLoadError}
                actionLabel="Réessayer"
                onAction={() => setDebriefKey((k) => k + 1)}
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

        {/* Bandeau permission notifications */}
        {permission !== "granted" && ready && (
          <div className="card-surface" style={{ padding: "0.9rem 1.1rem", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.9rem", color: "var(--text-soft)" }}>
              Active les rappels : un signal quand un créneau approche.
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

        {/* En-tête compact : cet écran s'ouvre plusieurs fois par jour, le
            contenu doit rester au-dessus de la ligne de flottaison. Le
            bouton principal n'y est que lorsque la journée a commencé ;
            vide, l'action principale est dans la carte, sous les yeux. */}
        <div className="day-hero day-hero-compact">
          <div style={{ minWidth: 0 }}>
            <span className="eyebrow">{mounted ? prettyDate(today) : "Ma journée"}</span>
            <h1 className="display-title display-title-sm" style={{ marginTop: "0.7rem" }}>
              Ta <span className="accent">journée</span>.
            </h1>
            {/* Pas d'accroche pendant les premiers pas : leur propre phrase
                d'introduction dit déjà la même chose. */}
            {empty && !showSteps && (
              <p className="day-hero-sub">
                Pose tes créneaux, valide le temps réel, garde ce que tu en retiens.
              </p>
            )}
          </div>
          {started && (
            <button className="btn-hero" onClick={openNew}>+ Nouvel objectif</button>
          )}
        </div>

        {showSteps && (
          <FirstSteps
            hasGoal={goals.length > 0}
            hasLinkedSession={linked.length > 0}
            hasValidatedSession={validated}
            hero={empty}
            onNewTask={openNew}
            onHide={hideSteps}
          />
        )}

        {/* Journée vide, premiers pas faits : la question et l'action au
            même endroit. */}
        {empty && !showSteps && goalsReady && (
          <section className="card-surface day-empty">
            <p className="section-title">Rien de prévu aujourd&apos;hui.</p>
            <p className="day-empty-text">
              Pose ton premier créneau — et le pourquoi qui te motive.
            </p>
            <button className="btn-hero" onClick={openNew}>+ Nouvel objectif</button>
            {/* « Masquer » ne doit pas être définitif tant que la boucle
                n'a pas été parcourue une fois. */}
            {!stepsDone && (
              <button className="link-quiet" style={{ marginTop: "0.9rem" }} onClick={showStepsAgain}>
                Revoir les premiers pas
              </button>
            )}
          </section>
        )}

        {/* La bande du jour n'apparaît qu'avec un premier
            objectif : un « 0 objectif · 0 terminé » ressemble à un constat
            d'échec, alors qu'il n'y a simplement encore rien à compter. */}
        {started && (
        <div className="day-layout">
          {/* Une bande pour le contexte du jour, au lieu d'un rail : les
              séances prennent toute la largeur. */}
          {ready && (
            <DaySummary
              tasks={plannedTasks}
              now={now}
              done={stats.done}
              minutesPrevues={minutesPrevues}
              minutesRealisees={minutesRealisees}
            />
          )}

          {/* Zone de travail */}
          <section className="day-main">
            {plannedTasks.map((t) => (
              <TaskCard key={t.id} task={t} goalTitle={goalTitle(t.goalId)} now={now} onStatus={setStatus}
              onComplete={completeTask} onNote={setNote} onEdit={openEdit} onArchive={archiveTask}
              onCatchUp={goToCatchUp} />
            ))}

            {/* Le débrief suit les séances, dans la même colonne. */}
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
                goals={goals}
                existing={existingDebrief ?? undefined}
                onSaved={() => setDebriefKey((k) => k + 1)}
              />
            )}
          </section>
        </div>
        )}
      </main>

      <TaskForm open={formOpen} editing={editing} existingTasks={tasks} goals={goals} onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={handleSubmit} />
    </>
  );
}
