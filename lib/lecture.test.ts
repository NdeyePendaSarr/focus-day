import { describe, it, expect } from "vitest";
import type { Task } from "./types";
import { estimationReading } from "./lecture";

let n = 0;
const task = (estimated: number, actual?: number, patch: Partial<Task> = {}): Task => ({
  id: `t${n++}`,
  date: "2026-10-01",
  name: "séance",
  start: "09:00",
  end: "10:00",
  status: "done",
  createdAt: "2026-10-01T08:00:00.000Z",
  estimatedMinutes: estimated,
  actualMinutes: actual,
  ...patch,
});

describe("estimationReading", () => {
  it("refuse de conclure sous cinq objectifs mesurés", () => {
    expect(estimationReading([task(60, 60), task(60, 90)])).toMatch(/Il en faut au moins 5/);
  });

  it("ne dit jamais « tombent juste » quand le temps réel est la copie de l'estimation", () => {
    // Le cas de l'expérimentation : rapport 1,00, temps réel recopié.
    const copies = Array.from({ length: 9 }, () => task(60, 60)).concat(task(60, 75));
    const texte = estimationReading(copies);
    expect(texte).toMatch(/90 % ont un temps réel exactement égal à l'estimation/);
    expect(texte).not.toMatch(/tombent juste/);
  });

  it("décrit l'écart quand le temps réel varie vraiment", () => {
    const vrais = [task(60, 55), task(60, 70), task(60, 50), task(60, 65), task(60, 62)];
    expect(estimationReading(vrais)).toMatch(/s'écarte en moyenne de \d+ % de tes estimations/);
  });

  it("signale une sous-estimation nette", () => {
    const longs = [task(60, 120), task(60, 100), task(60, 90), task(60, 110), task(60, 95)];
    expect(estimationReading(longs)).toMatch(/fois le temps que tu estimes/);
  });

  it("ignore le hors-plan et les objectifs sans temps réel", () => {
    const t = [task(60, undefined), task(0, 30, { origin: "unplanned" })];
    expect(estimationReading(t)).toMatch(/^0 objectif mesuré/);
  });
});
