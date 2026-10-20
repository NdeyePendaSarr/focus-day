import { describe, expect, it } from "vitest";
import { MIN_PASSWORD, passwordHint, passwordProblem } from "./password";

describe("passwordProblem", () => {
  it("dit combien de caractères manquent", () => {
    expect(passwordProblem("abc")).toBe("Encore 5 caractères : 8 au minimum.");
    expect(passwordProblem("abcdefg")).toBe("Encore 1 caractère : 8 au minimum.");
  });

  it("accepte à partir du minimum", () => {
    expect(MIN_PASSWORD).toBe(8);
    expect(passwordProblem("abcdefgh")).toBeNull();
    expect(passwordProblem("une phrase plus longue")).toBeNull();
  });

  it("compte un caractère accentué ou un emoji pour un", () => {
    expect(passwordProblem("éééééééé")).toBeNull();
    expect(passwordProblem("🔒🔒🔒🔒🔒🔒🔒")).toBe("Encore 1 caractère : 8 au minimum.");
  });

  it("a un message pour le champ vide", () => {
    expect(passwordProblem("")).toBe("Le mot de passe doit faire au moins 8 caractères.");
  });
});

describe("passwordHint", () => {
  it("suit la frappe", () => {
    expect(passwordHint("")).toBe("8 caractères minimum.");
    expect(passwordHint("abcd")).toBe("Encore 4 caractères : 8 au minimum.");
    expect(passwordHint("abcdefgh")).toBe("Longueur suffisante.");
  });
});
