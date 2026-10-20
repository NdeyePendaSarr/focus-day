import { describe, it, expect } from "vitest";
import type { Goal, GoalStatus, Task } from "./types";
import { summarize, buildPortfolio, plural, consacre, formatPeriod, lastSessionLabel, notesLabel, totals } from "./portfolio";

const goal = (id: string, status: GoalStatus = "active"): Goal => ({
  id,
  title: id,
  status,
  createdAt: "2026-10-01T00:00:00.000Z",
});

let n = 0;
const task = (patch: Partial<Task>): Task => ({
  id: `t${n++}`,
  date: "2026-10-19",
  name: "séance",
  start: "09:00",
  end: "10:00",
  status: "done",
  createdAt: "2026-10-19T08:00:00.000Z",
  ...patch,
});

describe("summarize", () => {
  it("additionne le temps réel, compte séances, jours actifs et notes", () => {
    const s = summarize(goal("g"), [
      task({ goalId: "g", date: "2026-10-19", actualMinutes: 60, note: "CALCULATE" }),
      task({ goalId: "g", date: "2026-10-19", actualMinutes: 30 }),
      task({ goalId: "g", date: "2026-10-21", actualMinutes: 45, note: "  " }),
      task({ goalId: "autre", actualMinutes: 500 }),
    ]);
    expect(s.minutes).toBe(135);
    expect(s.sessions).toHaveLength(3);
    expect(s.activeDays).toBe(2);
    expect(s.notes).toBe(1); // une note faite d'espaces n'en est pas une
    expect([s.firstDate, s.lastDate]).toEqual(["2026-10-19", "2026-10-21"]);
  });

  it("compte le hors-plan et l'archivé comme le reste", () => {
    const s = summarize(goal("g"), [
      task({ goalId: "g", origin: "unplanned", start: "", end: "", actualMinutes: 30 }),
      task({ goalId: "g", archived: true, actualMinutes: 20 }),
    ]);
    expect(s.minutes).toBe(50);
    expect(s.sessions).toHaveLength(2);
  });

  it("ne compte pas à zéro une séance sans temps réel : il la signale", () => {
    const s = summarize(goal("g"), [
      task({ goalId: "g", status: "missed" }),
      task({ goalId: "g", actualMinutes: 0 }), // « Pas fait »
    ]);
    expect(s.sessions).toHaveLength(0);
    expect(s.unmeasured).toBe(1);
    expect(s.firstDate).toBeUndefined();
  });
});

describe("buildPortfolio", () => {
  it("met les parcours terminés à part, en tête", () => {
    const p = buildPortfolio(
      [goal("a"), goal("d", "done"), goal("p", "paused"), goal("x", "abandoned")],
      []
    );
    expect(p.done.map((s) => s.goal.id)).toEqual(["d"]);
    expect(p.active.map((s) => s.goal.id)).toEqual(["a"]);
    expect(p.other.map((s) => s.goal.id).sort()).toEqual(["p", "x"]);
  });

  it("range par activité la plus récente, les parcours vides en dernier", () => {
    const p = buildPortfolio(
      [goal("vide"), goal("ancien"), goal("recent")],
      [
        task({ goalId: "ancien", date: "2026-09-01", actualMinutes: 600 }),
        task({ goalId: "recent", date: "2026-10-19", actualMinutes: 30 }),
      ]
    );
    expect(p.active.map((s) => s.goal.id)).toEqual(["recent", "ancien", "vide"]);
  });

  it("chiffre le temps qui n'est rattaché à aucun parcours", () => {
    const p = buildPortfolio(
      [goal("g")],
      [
        task({ actualMinutes: 90 }),
        task({ goalId: "supprime", actualMinutes: 10 }),
        task({ goalId: "g", actualMinutes: 60 }),
      ]
    );
    expect(p.unattachedMinutes).toBe(100);
  });
});

describe("formulations", () => {
  it("accorde au singulier en dessous de deux", () => {
    expect(plural(0, "note", "notes")).toBe("0 note");
    expect(plural(1, "séance", "séances")).toBe("1 séance");
    expect(plural(3, "séance", "séances")).toBe("3 séances");
  });

  it("accorde « consacrée »", () => {
    expect(consacre(45)).toBe("consacrées");
    expect(consacre(90)).toBe("consacrée");
    expect(consacre(48 * 60)).toBe("consacrées");
  });

  it("formule la période", () => {
    expect(formatPeriod("2026-10-19", "2026-10-19")).toBe("le 19 octobre 2026");
    expect(formatPeriod("2026-10-19", "2026-10-21")).toBe("du 19 au 21 octobre 2026");
    expect(formatPeriod("2026-09-03", "2026-10-06")).toBe("du 3 septembre au 6 octobre 2026");
    expect(formatPeriod("2025-12-12", "2026-01-04")).toBe("du 12 décembre 2025 au 4 janvier 2026");
    expect(formatPeriod("2026-09-01", "2026-10-01")).toBe("du 1er septembre au 1er octobre 2026");
    expect(formatPeriod(undefined, undefined)).toBe("");
  });
});

describe("lastSessionLabel", () => {
  it("dit l'écart en jours, puis la date au-delà de deux semaines", () => {
    expect(lastSessionLabel("2026-10-20", "2026-10-20")).toBe("aujourd'hui");
    expect(lastSessionLabel("2026-10-19", "2026-10-20")).toBe("hier");
    expect(lastSessionLabel("2026-10-15", "2026-10-20")).toBe("il y a 5 jours");
    expect(lastSessionLabel("2026-09-01", "2026-10-20")).toBe("le 1er septembre 2026");
  });

  it("franchit un changement d'heure sans se tromper d'un jour", () => {
    // Passage à l'heure d'hiver en Europe le 25 octobre 2026.
    expect(lastSessionLabel("2026-10-24", "2026-10-26")).toBe("il y a 2 jours");
  });
});

describe("notesLabel et totals", () => {
  it("ne met pas de zéro à côté des heures", () => {
    expect(notesLabel(0)).toBe("aucune note encore");
    expect(notesLabel(1)).toBe("1 note");
    expect(notesLabel(14)).toBe("14 notes");
  });

  it("additionne heures et notes de tous les parcours", () => {
    const p = buildPortfolio(
      [goal("a"), goal("d", "done")],
      [
        task({ goalId: "a", actualMinutes: 60, note: "x" }),
        task({ goalId: "d", actualMinutes: 90 }),
        task({ actualMinutes: 500 }), // sans parcours : hors total
      ]
    );
    expect(totals(p)).toEqual({ parcours: 2, minutes: 150, notes: 1 });
  });
});
