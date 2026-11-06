import { describe, it, expect } from "vitest";
import { writeFailureMessage, errorDetail, KEEPS_INPUT, type WriteAction } from "./errors";

const ACTIONS: WriteAction[] = [
  "add", "edit", "status", "complete", "note", "actual", "unplanned", "archive", "remove",
];

describe("writeFailureMessage", () => {
  it("nomme l'objectif concerné", () => {
    expect(writeFailureMessage("add", "Réviser DAX")).toContain("« Réviser DAX »");
  });

  it("dit toujours que rien n'a été enregistré, et quoi faire", () => {
    for (const action of ACTIONS) {
      const msg = writeFailureMessage(action, "X");
      expect(msg, action).toMatch(/n'a pas été|n'ont pas été/);
      // Formulaire rouvert avec la saisie : réessayer. Sinon : refaire.
      expect(msg, action).toMatch(KEEPS_INPUT.includes(action) ? /Ta saisie est restée/ : /Il faut/);
    }
  });

  it("ne laisse pas de guillemets vides quand le nom manque", () => {
    expect(writeFailureMessage("edit", "  ")).toContain("« sans titre »");
  });
});

describe("errorDetail", () => {
  it("reprend le message d'une Error", () => {
    expect(errorDetail(new Error("[42501] refusé"))).toBe("[42501] refusé");
  });

  it("traduit le refus d'une contrainte de longueur", () => {
    const brut = '[23514] new row for relation "sessions" violates check constraint "sessions_note_len"';
    expect(errorDetail(new Error(brut))).toBe(
      "Un texte dépasse la longueur autorisée (sessions_note) : raccourcis-le, puis réessaie."
    );
  });

  it("renvoie undefined pour un objet sans message", () => {
    expect(errorDetail({})).toBeUndefined();
    expect(errorDetail(new Error(""))).toBeUndefined();
  });
});
