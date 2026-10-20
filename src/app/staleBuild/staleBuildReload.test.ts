import { describe, it, expect, vi } from "vitest";
import { reloadForNewBuild, reloadingForNewBuild } from "./staleBuildReload";

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

describe("reloadForNewBuild", () => {
  it("reloads when a code file from the build the tab started with is gone", () => {
    const reload = vi.fn();
    expect(reloadForNewBuild(storage(), 1_000_000, reload)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("says it's reloading, so the error it caught isn't shown or recorded meanwhile", () => {
    reloadForNewBuild(storage(), 1_000_000, () => {});
    expect(reloadingForNewBuild()).toBe(true);
  });

  it("doesn't reload again within a minute, so a file that's really missing can't loop", () => {
    const tab = storage();
    const reload = vi.fn();
    reloadForNewBuild(tab, 1_000_000, reload);

    expect(reloadForNewBuild(tab, 1_030_000, reload)).toBe(false);
    expect(reloadForNewBuild(tab, 1_061_000, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
