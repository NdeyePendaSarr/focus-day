import { describe, expect, it } from "vitest";
import { messageFr } from "./authMessages";

describe("messageFr", () => {
  it("traduit les erreurs connues", () => {
    expect(messageFr("Invalid login credentials")).toBe("Email ou mot de passe incorrect.");
    expect(messageFr("New password should be different from the old password.")).toBe(
      "Choisis un mot de passe différent de l'actuel."
    );
    expect(
      messageFr("For security purposes, you can only request this after 42 seconds.")
    ).toBe("Trop de demandes d'affilée. Attends une minute, puis réessaie.");
    expect(messageFr("email rate limit exceeded")).toBe(
      "Trop de demandes d'affilée. Attends une minute, puis réessaie."
    );
  });

  it("laisse passer un message inconnu plutôt que de le masquer", () => {
    expect(messageFr("Something new")).toBe("Something new");
  });
});
