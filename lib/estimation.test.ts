import { describe, expect, it } from "vitest";
import { LONG_SLOT_MINUTES, missingEstimation, plannedMinutes, isSignificantGap } from "./estimation";

describe("missingEstimation", () => {
  it("laisse vide un créneau ordinaire : vide = durée du créneau", () => {
    expect(missingEstimation(90, "")).toBeNull();
    expect(missingEstimation(LONG_SLOT_MINUTES, "")).toBeNull();
  });

  it("exige l'estimation au-delà de 4 h", () => {
    expect(missingEstimation(630, "")).toBe(
      "Ce créneau dure 10 h 30 : combien de temps penses-tu y passer vraiment ?"
    );
  });

  it("accepte une estimation saisie, même pour un long créneau", () => {
    expect(missingEstimation(630, "3h")).toBeNull();
    expect(missingEstimation(630, "180")).toBeNull();
  });

  it("refuse un texte illisible plutôt que de retomber sur le créneau", () => {
    expect(missingEstimation(630, "beaucoup")).not.toBeNull();
  });
});

describe("plannedMinutes", () => {
  it("prend l'estimation quand elle existe", () => {
    expect(plannedMinutes({ estimatedMinutes: 45, start: "09:00", end: "11:00" })).toBe(45);
  });
  it("sinon la durée du créneau, y compris à cheval sur minuit", () => {
    expect(plannedMinutes({ start: "09:00", end: "10:30" })).toBe(90);
    expect(plannedMinutes({ start: "23:00", end: "01:00" })).toBe(120);
  });
});

describe("isSignificantGap", () => {
  it("au-delà de 15 % d'écart seulement, dans les deux sens", () => {
    expect(isSignificantGap(69, 60)).toBe(false); // +15 % pile : normal
    expect(isSignificantGap(70, 60)).toBe(true);
    expect(isSignificantGap(51, 60)).toBe(false);
    expect(isSignificantGap(50, 60)).toBe(true);
  });
  it("rien à comparer sans prévu", () => {
    expect(isSignificantGap(30, 0)).toBe(false);
  });
});
