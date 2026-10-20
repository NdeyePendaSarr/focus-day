import { describe, expect, it } from "vitest";
import { LIMITS, charCount } from "./limits";

describe("charCount", () => {
  it("reste caché loin de la limite", () => {
    expect(charCount("", 200)).toBeNull();
    expect(charCount("a".repeat(159), 200)).toBeNull();
  });

  it("apparaît à 80 % de la limite", () => {
    expect(charCount("a".repeat(160), 200)).toEqual({ label: "160 / 200", full: false });
  });

  it("le dit quand la limite est atteinte", () => {
    const c = charCount("a".repeat(LIMITS.note), LIMITS.note);
    expect(c?.full).toBe(true);
    expect(c?.label).toMatch(/limite atteinte$/);
  });

  it("reste au-dessus des saisies réelles de production", () => {
    // Plus longues valeurs mesurées le 20 octobre 2026.
    expect(LIMITS.note).toBeGreaterThan(341);
    expect(LIMITS.taskTitle).toBeGreaterThan(107);
    expect(LIMITS.description).toBeGreaterThan(262);
    expect(LIMITS.why).toBeGreaterThan(113);
    expect(LIMITS.goalTitle).toBeGreaterThan(46);
  });
});
