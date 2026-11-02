import { describe, expect, it } from "vitest";
import { LONG_SLOT_MINUTES, missingEstimation } from "./estimation";

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
