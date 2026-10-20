import { describe, expect, it, vi } from "vitest";
import { RETRY_DELAY_MS, retryOnJwtFuture, withJwtRetry } from "./jwtRetry";

const jwtFuture = () => new Error("[PGRST303] JWT issued at future");
const noWait = vi.fn(async () => {});

describe("retryOnJwtFuture", () => {
  it("réessaie une fois sur PGRST303, après la pause prévue", async () => {
    const wait = vi.fn(async () => {});
    const fn = vi.fn().mockRejectedValueOnce(jwtFuture()).mockResolvedValueOnce("ok");
    await expect(retryOnJwtFuture(fn, wait)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(RETRY_DELAY_MS);
  });

  it("une seule fois : le second échec remonte tel quel", async () => {
    const fn = vi.fn().mockRejectedValue(jwtFuture());
    await expect(retryOnJwtFuture(fn, noWait)).rejects.toThrow("[PGRST303]");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("ne réessaie pas sur une autre erreur", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("[42501] permission denied"));
    await expect(retryOnJwtFuture(fn, noWait)).rejects.toThrow("[42501]");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("ne réessaie pas sur un échec réseau", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(retryOnJwtFuture(fn, noWait)).rejects.toThrow("Failed to fetch");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("withJwtRetry", () => {
  it("enveloppe chaque méthode en gardant ses arguments", async () => {
    let essais = 0;
    const repo = {
      async patch(id: string, v: number) {
        essais++;
        if (essais === 1) throw jwtFuture();
        return `${id}:${v}`;
      },
    };
    vi.useFakeTimers();
    const p = withJwtRetry(repo).patch("a", 3);
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    await expect(p).resolves.toBe("a:3");
    vi.useRealTimers();
    expect(essais).toBe(2);
  });
});
