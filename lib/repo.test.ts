import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "./types";
import { localRepo } from "./repo";

// Le dépôt local lit et écrit localStorage : un stockage en mémoire suffit.
const store = new Map<string, string>();
vi.stubGlobal("window", {});
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
});

const task = (id: string, status: Task["status"], extra: Partial<Task> = {}): Task => ({
  id,
  date: "2026-11-06",
  name: id,
  start: "09:00",
  end: "10:00",
  status,
  createdAt: "2026-11-06T08:00:00.000Z",
  ...extra,
});

const seed = (tasks: Task[]) => store.set("focusday.tasks", JSON.stringify(tasks));
const stored = (): Task[] => JSON.parse(store.get("focusday.tasks") ?? "[]");

describe("localRepo.tasks.markMissed", () => {
  beforeEach(() => store.clear());

  it("ne change que le statut : une note écrite entre-temps reste", async () => {
    seed([task("a", "planned", { note: "écrite dans un autre onglet" })]);
    await expect(localRepo.tasks.markMissed(["a"])).resolves.toBe(1);
    expect(stored()[0]).toMatchObject({ status: "missed", note: "écrite dans un autre onglet" });
  });

  it("laisse une séance démarrée ou validée ailleurs entre-temps", async () => {
    seed([task("a", "in_progress"), task("b", "done"), task("c", "planned")]);
    await expect(localRepo.tasks.markMissed(["a", "b", "c"])).resolves.toBe(1);
    expect(stored().map((t) => t.status)).toEqual(["in_progress", "done", "missed"]);
  });

  it("ne touche pas aux séances non demandées", async () => {
    seed([task("a", "planned"), task("b", "planned")]);
    await localRepo.tasks.markMissed(["a"]);
    expect(stored().map((t) => t.status)).toEqual(["missed", "planned"]);
  });

  it("liste vide : rien à faire", async () => {
    await expect(localRepo.tasks.markMissed([])).resolves.toBe(0);
  });
});
