import { describe, expect, it } from "vitest";
import { toPatchRow } from "./sessionPatch";

describe("toPatchRow", () => {
  it("n'envoie que les colonnes modifiées", () => {
    // La validation d'une séance (completeTask) : rien d'autre ne part.
    expect(
      toPatchRow({
        status: "done",
        completedAt: "2026-10-20T10:00:00.000Z",
        actualMinutes: 45,
        actualSource: "panneau",
        gapReason: undefined,
        note: "CALCULATE et le contexte de filtre",
      })
    ).toEqual({
      status: "done",
      completed_at: "2026-10-20T10:00:00.000Z",
      actual_minutes: 45,
      actual_source: "panneau",
      gap_reason: null,
      note: "CALCULATE et le contexte de filtre",
    });
  });

  it("efface une valeur présente mais vide", () => {
    expect(toPatchRow({ note: undefined })).toEqual({ note: null });
  });

  it("ne touche pas à une note absente de la modification", () => {
    // Validation sans note : la clé note n'existe pas, la note en base reste.
    expect(toPatchRow({ status: "done", actualMinutes: 30 })).not.toHaveProperty("note");
  });

  it("reprend les conversions de l'enregistrement complet", () => {
    expect(
      toPatchRow({ name: "Réviser", start: "", end: "10:30", goalId: undefined, archived: undefined })
    ).toEqual({ title: "Réviser", planned_start: null, planned_end: "10:30", goal_id: null, archived: false });
  });

  it("refuse un champ non modifiable", () => {
    expect(() => toPatchRow({ id: "x" })).toThrow(/non modifiable/);
    expect(() => toPatchRow({ createdAt: "x" })).toThrow(/non modifiable/);
  });
});
