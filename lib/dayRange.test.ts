import { describe, expect, it } from "vitest";
import { dayRange, rangePct } from "./dayRange";

describe("dayRange", () => {
  it("se cale sur les créneaux, avec une heure de marge", () => {
    const r = dayRange([{ start: "09:00", end: "10:30" }, { start: "14:00", end: "15:00" }], 12 * 60);
    expect(r.start).toBe(8 * 60);
    expect(r.end).toBe(16 * 60);
  });

  it("contient toujours « maintenant »", () => {
    const r = dayRange([{ start: "09:00", end: "10:00" }], 20 * 60);
    expect(r.end).toBeGreaterThanOrEqual(20 * 60);
  });

  it("garde au moins quatre heures", () => {
    const r = dayRange([{ start: "10:00", end: "10:30" }], 10 * 60);
    expect(r.end - r.start).toBeGreaterThanOrEqual(4 * 60);
  });

  it("espace les graduations sur une longue journée", () => {
    const r = dayRange([{ start: "09:00", end: "19:30" }], 20 * 60);
    expect(r.hours).toEqual([8, 11, 14, 17, 20]);
  });

  it("place une minute en pourcentage, bornée", () => {
    const r = { start: 600, end: 840, hours: [] };
    expect(rangePct(r, 720)).toBe(50);
    expect(rangePct(r, 0)).toBe(0);
    expect(rangePct(r, 2000)).toBe(100);
  });
});
