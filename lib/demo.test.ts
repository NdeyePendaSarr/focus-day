import { describe, expect, it } from "vitest";
import { buildDemoData, seedDemo, resetDemo, DEMO_KEYS } from "./demo";
import { shiftISO, toMinutes, endMinutesAdjusted, MAX_DURATION_MINUTES } from "./time";
import { estimationReading } from "./lecture";
import { buildPortfolio } from "./portfolio";

const TODAY = "2026-11-16";
const NOW = 15 * 60; // 15 h

describe("buildDemoData", () => {
  const d = buildDemoData(TODAY, NOW);
  const goalIds = new Set(d.goals.map((g) => g.id));

  it("des parcours de chaque statut proposé : en cours, terminé, en pause", () => {
    const statuts = new Set(d.goals.map((g) => g.status));
    expect(statuts).toEqual(new Set(["active", "done", "paused"]));
    expect(goalIds.size).toBe(d.goals.length);
  });

  it("chaque séance rattachée pointe vers un parcours qui existe", () => {
    for (const t of d.tasks) if (t.goalId) expect(goalIds.has(t.goalId), t.name).toBe(true);
  });

  it("des identifiants uniques", () => {
    expect(new Set(d.tasks.map((t) => t.id)).size).toBe(d.tasks.length);
  });

  it("toutes les dates sont passées ou aujourd'hui, sur plusieurs semaines", () => {
    const dates = d.tasks.map((t) => t.date).sort();
    expect(dates[dates.length - 1]).toBe(TODAY);
    expect(dates[0] <= shiftISO(TODAY, -28)).toBe(true);
  });

  it("le tableau de bord a de quoi lire : au moins 8 jours renseignés sur 14", () => {
    const debut = shiftISO(TODAY, -13);
    const jours = new Set(
      d.tasks.filter((t) => t.date >= debut && t.actualMinutes != null).map((t) => t.date)
    );
    expect(jours.size).toBeGreaterThanOrEqual(8);
  });

  it("pas de jour renseigné sans séance planifiée : le tableau de bord ne lit pas « 12 sur 11 »", () => {
    const planifies = new Set(d.tasks.filter((t) => t.origin !== "unplanned").map((t) => t.date));
    for (const t of d.tasks) if (t.actualMinutes != null) expect(planifies.has(t.date), t.date).toBe(true);
  });

  it("un biais d'estimation lisible : le tableau de bord a quelque chose à dire", () => {
    expect(estimationReading(d.tasks)).toMatch(/fois le temps que tu estimes/);
  });

  it("des durées que la base accepterait (estimation > 0, réel ≤ 24 h)", () => {
    for (const t of d.tasks) {
      if (t.estimatedMinutes != null) expect(t.estimatedMinutes, t.name).toBeGreaterThan(0);
      if (t.actualMinutes != null) {
        expect(t.actualMinutes, t.name).toBeGreaterThanOrEqual(0);
        expect(t.actualMinutes, t.name).toBeLessThanOrEqual(MAX_DURATION_MINUTES);
      }
    }
  });

  it("des temps réels qui ne recopient pas l'estimation : la lecture conclut", () => {
    // Sinon le tableau de bord afficherait « vérifie que le temps réel
    // n'est pas le créneau prévu », ce qui ferait mauvaise impression.
    expect(estimationReading(d.tasks)).not.toMatch(/exactement égal/);
  });

  it("aucune séance passée laissée « prévue » : la journée et l'historique restent cohérents", () => {
    for (const t of d.tasks) {
      if (t.status !== "planned") continue;
      const fin = t.date === TODAY ? endMinutesAdjusted(t.start, t.end) : -1;
      expect(t.date === TODAY && fin > NOW, `${t.date} ${t.name}`).toBe(true);
    }
  });

  it("aujourd'hui : une séance faite, une en cours, une à venir", () => {
    const duJour = d.tasks.filter((t) => t.date === TODAY && t.origin !== "unplanned");
    expect(duJour.map((t) => t.status).sort()).toEqual(["done", "in_progress", "planned"]);
    const enCours = duJour.find((t) => t.status === "in_progress")!;
    expect(toMinutes(enCours.start) <= NOW && NOW < endMinutesAdjusted(enCours.start, enCours.end)).toBe(true);
  });

  it("des notes et du hors-plan, comme un vrai carnet", () => {
    const rattachees = d.tasks.filter((t) => t.goalId && (t.actualMinutes ?? 0) > 0);
    const notees = rattachees.filter((t) => (t.note ?? "").trim().length >= 20);
    expect(notees.length / rattachees.length).toBeGreaterThan(0.4);
    const horsPlan = d.tasks.filter((t) => t.origin === "unplanned");
    expect(horsPlan.length).toBeGreaterThan(0);
    for (const t of horsPlan) {
      expect(t.start).toBe("");
      expect(t.actualMinutes ?? 0).toBeGreaterThan(0);
    }
  });

  it("un portfolio qui montre un parcours terminé et des heures", () => {
    const p = buildPortfolio(d.goals, d.tasks);
    expect(p.done.length).toBeGreaterThan(0);
    expect(p.done[0].minutes).toBeGreaterThan(10 * 60);
  });

  it("des débriefs sur des jours passés, un par jour", () => {
    const dates = d.debriefs.map((x) => x.date);
    expect(new Set(dates).size).toBe(dates.length);
    for (const x of dates) expect(x < TODAY).toBe(true);
  });

  it("déterministe : mêmes entrées, mêmes données", () => {
    expect(buildDemoData(TODAY, NOW)).toEqual(d);
  });

  it("tient le matin et le soir : la séance en cours englobe toujours l'heure", () => {
    for (const now of [0, 6 * 60, 23 * 60 + 59]) {
      const x = buildDemoData(TODAY, now);
      const enCours = x.tasks.find((t) => t.date === TODAY && t.status === "in_progress")!;
      const s = toMinutes(enCours.start);
      const e = endMinutesAdjusted(enCours.start, enCours.end);
      expect(s <= now && now < e, `à ${now} min`).toBe(true);
    }
  });
});

/** Stockage en mémoire, à la façon de localStorage. */
function memoire(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

describe("seedDemo / resetDemo", () => {
  it("remplit un navigateur vide", () => {
    const s = memoire();
    expect(seedDemo(s, TODAY, NOW)).toBe(true);
    expect(JSON.parse(s.getItem(DEMO_KEYS.tasks)!).length).toBeGreaterThan(20);
  });

  it("ne remplace jamais ce qui est déjà là : les essais du visiteur restent", () => {
    const s = memoire();
    seedDemo(s, TODAY, NOW);
    s.setItem(DEMO_KEYS.tasks, "[]");
    expect(seedDemo(s, TODAY, NOW)).toBe(false);
    expect(s.getItem(DEMO_KEYS.tasks)).toBe("[]");
  });

  it("réinitialiser efface tout, et le prochain chargement repart des données fictives", () => {
    const s = memoire();
    seedDemo(s, TODAY, NOW);
    resetDemo(s);
    for (const k of Object.values(DEMO_KEYS)) expect(s.getItem(k)).toBeNull();
    expect(seedDemo(s, TODAY, NOW)).toBe(true);
  });
});
