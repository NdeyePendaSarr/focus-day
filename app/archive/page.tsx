"use client";

import { useEffect, useState, useCallback } from "react";
import type { Task } from "@/lib/types";
import { repo } from "@/lib/repo";
import { prettyDate } from "@/lib/time";
import NavBar from "@/components/NavBar";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import { errorDetail } from "@/lib/errors";

export default function ArchivePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Échec d'une restauration ou d'une suppression : jusqu'ici, rien ne
  // le signalait et l'objectif restait simplement dans la liste.
  const [writeError, setWriteError] = useState<{ message: string; detail?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await repo.tasks.archived());
      setLoadError(null);
    } catch (e) {
      setLoadError(errorDetail(e) ?? "erreur inconnue");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unarchive = async (t: Task) => {
    setWriteError(null);
    try {
      await repo.tasks.save({ ...t, archived: false, archivedAt: undefined });
    } catch (e) {
      setWriteError({
        message: `« ${t.name} » n'a pas été restauré : il est toujours dans les archives. Tu peux réessayer.`,
        detail: errorDetail(e),
      });
    }
    await load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const t = toDelete;
    setToDelete(null);
    setWriteError(null);
    try {
      await repo.tasks.remove(t.id);
    } catch (e) {
      setWriteError({
        message: `« ${t.name} » n'a pas été supprimé : il est toujours dans les archives.`,
        detail: errorDetail(e),
      });
    }
    await load();
  };

  return (
    <>
      <NavBar />
      <main className="page-shell" style={{ paddingTop: "1.5rem", paddingBottom: "4rem" }}>
        <PageHeader
          eyebrow="Archives"
          before="Rangés,"
          accent="pas effacés"
          sub="Les objectifs que tu as rangés. Tu peux les restaurer, ou les supprimer définitivement."
        />

        {(loadError || writeError) && (
          <div style={{ display: "grid", gap: 8, marginBottom: "1rem", maxWidth: 960 }}>
            {loadError && (
              <ErrorBanner
                message={
                  tasks.length === 0
                    ? "Tes archives n'ont pas pu être chargées. Rien n'est effacé : c'est la lecture depuis le serveur qui a échoué."
                    : "Les archives n'ont pas pu être rechargées. Ce qui s'affiche n'est peut-être plus à jour."
                }
                detail={loadError}
                actionLabel="Réessayer"
                onAction={() => void load()}
              />
            )}
            {writeError && (
              <ErrorBanner
                message={writeError.message}
                detail={writeError.detail}
                actionLabel="J'ai compris"
                onAction={() => setWriteError(null)}
              />
            )}
          </div>
        )}

        {loadError && tasks.length === 0 ? null : !ready ? (
          <div className="card-surface" style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-mute)" }}>
            Chargement…
          </div>
        ) : tasks.length === 0 ? (
          <div className="card-surface" style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-mute)" }}>
            Aucun objectif archivé. Depuis « Ma journée », le bouton « Archiver » range un objectif ici.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {tasks.map((t) => (
              <div key={t.id} className="card-surface" style={{ padding: "1rem 1.3rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", maxWidth: 960 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", fontWeight: 600, color: "var(--color-brand)" }}>
                      {t.start}–{t.end}
                    </span>
                    <h3 style={{ fontSize: "0.98rem", fontWeight: 600 }}>{t.name}</h3>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-mute)", marginTop: 2 }}>
                    {prettyDate(t.date)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="chip" onClick={() => unarchive(t)}>Restaurer</button>
                  <button className="chip chip-rose" onClick={() => setToDelete(t)}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer définitivement ?"
        message={toDelete ? `« ${toDelete.name} » sera supprimé pour de bon. Cette action est irréversible.` : ""}
        confirmLabel="Supprimer"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}