import { describe, it, expect } from "vitest";
import type { Task } from "./types";
import {
  toMinutes,
  crossesMidnight,
  spillsIntoNextDay,
  endMinutesAdjusted,
  durationMinutes,
  shiftISO,
  formatDuration,
  computeStats,
  reconcileStatus,
  timePosition,
  prettyDate,
  overlaps,
  findConflict,
  todayISO,
  parseDuration,
} from "./time";

/** Fabrique une tâche minimale pour les tests. */
function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: over.id ?? "t1",
    date: over.date ?? "2026-08-13",
    name: over.name ?? "Objectif",
    start: over.start ?? "09:00",
    end: over.end ?? "10:00",
    status: over.status ?? "planned",
    createdAt: over.createdAt ?? "2026-08-13T00:00:00.000Z",
    ...over,
  };
}

describe("toMinutes", () => {
  it("convertit une heure hh:mm en minutes depuis minuit", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("23:59")).toBe(1439);
  });
});

describe("crossesMidnight", () => {
  it("est faux pour un créneau diurne classique", () => {
    expect(crossesMidnight("09:00", "10:00")).toBe(false);
  });
  it("est vrai pour un créneau nocturne (fin <= début)", () => {
    expect(crossesMidnight("22:00", "01:00")).toBe(true);
  });
  it("traite une fin pile à minuit comme <= début", () => {
    // 00:00 (0) <= 22:00 (1320) au sens strict
    expect(crossesMidnight("22:00", "00:00")).toBe(true);
  });
});

describe("spillsIntoNextDay", () => {
  it("distingue une fin pile à minuit d'un vrai débordement", () => {
    // 22:00 -> 00:00 : se termine pile à minuit, ne déborde sur rien
    expect(spillsIntoNextDay("22:00", "00:00")).toBe(false);
    // 22:00 -> 01:00 : déborde réellement d'1h sur le lendemain
    expect(spillsIntoNextDay("22:00", "01:00")).toBe(true);
  });
  it("est faux pour un créneau diurne", () => {
    expect(spillsIntoNextDay("09:00", "10:00")).toBe(false);
  });
});

describe("endMinutesAdjusted / durationMinutes", () => {
  it("décale la fin de +24h quand le créneau traverse minuit", () => {
    expect(endMinutesAdjusted("22:00", "01:00")).toBe(25 * 60);
  });
  it("calcule une durée diurne simple", () => {
    expect(durationMinutes("09:00", "10:30")).toBe(90);
  });
  it("calcule une durée qui traverse minuit", () => {
    expect(durationMinutes("22:00", "01:00")).toBe(180);
  });
});

describe("shiftISO", () => {
  it("décale une date ISO d'un nombre de jours", () => {
    expect(shiftISO("2026-08-13", 1)).toBe("2026-08-14");
    expect(shiftISO("2026-08-13", -1)).toBe("2026-08-12");
  });
  it("gère les changements de mois", () => {
    expect(shiftISO("2026-08-31", 1)).toBe("2026-09-01");
  });
  it("gère les années bissextiles", () => {
    expect(shiftISO("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("formatDuration", () => {
  it("formate les minutes seules", () => {
    expect(formatDuration(40)).toBe("40 min");
  });
  it("formate les heures pleines", () => {
    expect(formatDuration(120)).toBe("2 h");
  });
  it("formate heures + minutes avec zéro de tête", () => {
    expect(formatDuration(75)).toBe("1 h 15");
  });
});

describe("computeStats", () => {
  it("compte chaque statut et calcule le taux de réussite", () => {
    const tasks = [
      makeTask({ id: "a", status: "done" }),
      makeTask({ id: "b", status: "done" }),
      makeTask({ id: "c", status: "missed" }),
      makeTask({ id: "d", status: "in_progress" }),
    ];
    const s = computeStats(tasks);
    expect(s.total).toBe(4);
    expect(s.done).toBe(2);
    expect(s.missed).toBe(1);
    expect(s.inProgress).toBe(1);
    expect(s.successRate).toBe(50);
  });
  it("renvoie 0% sans division par zéro sur une liste vide", () => {
    expect(computeStats([]).successRate).toBe(0);
  });
});

describe("reconcileStatus", () => {
  it("bascule une tâche planifiée dont le créneau est passé en 'missed'", () => {
    const task = makeTask({ start: "08:00", end: "09:00", status: "planned" });
    // maintenant = 10:00, après la fin du créneau
    const out = reconcileStatus(task, 10 * 60, "2026-08-13");
    expect(out.status).toBe("missed");
  });
  it("ne touche pas une tâche encore à venir", () => {
    const task = makeTask({ start: "15:00", end: "16:00", status: "planned" });
    const out = reconcileStatus(task, 10 * 60, "2026-08-13");
    expect(out.status).toBe("planned");
  });
  it("ne re-bascule pas une tâche déjà terminée", () => {
    const task = makeTask({ start: "08:00", end: "09:00", status: "done" });
    const out = reconcileStatus(task, 10 * 60, "2026-08-13");
    expect(out.status).toBe("done");
  });
});

describe("timePosition", () => {
  const today = "2026-08-13";
  const task = makeTask({ start: "09:00", end: "11:00" });
  it("détecte un créneau à venir", () => {
    expect(timePosition(task, 8 * 60, today)).toBe("upcoming");
  });
  it("détecte un créneau en cours", () => {
    expect(timePosition(task, 10 * 60, today)).toBe("current");
  });
  it("détecte un créneau passé", () => {
    expect(timePosition(task, 12 * 60, today)).toBe("past");
  });
});

describe("overlaps", () => {
  it("détecte deux créneaux qui se chevauchent", () => {
    expect(overlaps("09:00", "11:00", "10:00", "12:00")).toBe(true);
  });
  it("ne signale pas deux créneaux qui se touchent bord à bord", () => {
    expect(overlaps("09:00", "10:00", "10:00", "11:00")).toBe(false);
  });
  it("gère un chevauchement avec un créneau nocturne", () => {
    // 22:00-01:00 chevauche 00:30-02:00 (via le rebouclage minuit)
    expect(overlaps("22:00", "01:00", "00:30", "02:00")).toBe(true);
  });
});

describe("findConflict", () => {
  const tasks = [
    makeTask({ id: "a", start: "09:00", end: "14:00" }),
    makeTask({ id: "b", start: "16:00", end: "18:00" }),
  ];
  it("renvoie la tâche en conflit", () => {
    expect(findConflict(tasks, "10:00", "11:00")?.id).toBe("a");
  });
  it("renvoie null quand le créneau est libre", () => {
    expect(findConflict(tasks, "14:00", "16:00")).toBeNull();
  });
  it("s'exclut lui-même via selfId (édition d'une tâche existante)", () => {
    expect(findConflict(tasks, "09:00", "14:00", "a")).toBeNull();
  });
});

describe("prettyDate", () => {
  it("formate une date ISO en français avec l'année", () => {
    expect(prettyDate("2026-08-13")).toBe("jeudi 13 août 2026");
  });
});

describe("todayISO", () => {
  it("produit une date locale au format yyyy-mm-dd", () => {
    const d = new Date(2026, 7, 5); // 5 août 2026, heure locale
    expect(todayISO(d)).toBe("2026-08-05");
  });
});

describe("parseDuration", () => {
  it("comprend un nombre seul comme des minutes", () => {
    expect(parseDuration("90")).toBe(90);
  });
  it("comprend les heures et minutes combinées", () => {
    expect(parseDuration("1h30")).toBe(90);
    expect(parseDuration("2 h 05")).toBe(125);
  });
  it("comprend les heures seules et décimales", () => {
    expect(parseDuration("1h")).toBe(60);
    expect(parseDuration("1,5h")).toBe(90);
  });
  it("comprend les minutes suffixées", () => {
    expect(parseDuration("45min")).toBe(45);
  });
  it("renvoie null sur une saisie vide ou incomprise", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("bientôt")).toBeNull();
  });
});
