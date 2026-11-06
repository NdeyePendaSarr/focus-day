import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "./pagination";

/** Table fictive de n lignes, servie par tranches comme .range(). */
const table = (n: number) => Array.from({ length: n }, (_, i) => i);
const server = (rows: number[]) =>
  vi.fn(async (from: number, to: number) => rows.slice(from, to + 1));

describe("fetchAllPages", () => {
  it("lit au-delà d'une page : rien n'est perdu après la première", async () => {
    const fetchPage = server(table(2500));
    const rows = await fetchAllPages(fetchPage, 1000);
    expect(rows).toEqual(table(2500));
    expect(fetchPage.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("une table plus petite qu'une page : un seul appel", async () => {
    const fetchPage = server(table(3));
    await expect(fetchAllPages(fetchPage, 1000)).resolves.toEqual([0, 1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("table vide : un appel, aucune ligne", async () => {
    const fetchPage = server([]);
    await expect(fetchAllPages(fetchPage, 1000)).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("pile un multiple de la page : une dernière page vide clôt la lecture", async () => {
    const fetchPage = server(table(2000));
    await expect(fetchAllPages(fetchPage, 1000)).resolves.toHaveLength(2000);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("une erreur sur une page remonte, sans résultat partiel", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(table(1000))
      .mockRejectedValueOnce(new Error("[500] panne"));
    await expect(fetchAllPages(fetchPage, 1000)).rejects.toThrow("panne");
  });
});
