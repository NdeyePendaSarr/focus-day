import { describe, it, expect } from "vitest";
import type { Goal, GoalStatus } from "./types";
import { selectableGoals } from "./goals";

const goal = (id: string, status: GoalStatus): Goal => ({
  id,
  title: id,
  status,
  createdAt: "2026-10-01T00:00:00.000Z",
});

describe("selectableGoals", () => {
  const goals = [goal("a", "active"), goal("p", "paused"), goal("d", "done")];

  it("ne propose que les parcours en cours", () => {
    expect(selectableGoals(goals).map((g) => g.id)).toEqual(["a"]);
  });

  it("garde le parcours déjà rattaché même s'il est archivé", () => {
    // Sans cela, modifier un ancien objectif effacerait son rattachement.
    expect(selectableGoals(goals, "d").map((g) => g.id)).toEqual(["a", "d"]);
  });
});
