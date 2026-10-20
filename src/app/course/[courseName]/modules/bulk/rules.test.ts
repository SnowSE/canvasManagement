import { describe, it, expect, vi } from "vitest";
import { kindsOf, shown, toggleAll, updateEach } from "./rules";

const status = (s: { status?: "localOnly" | "incomplete" | "published"; differences?: number; unpublished?: boolean }) => ({
  status: s.status ?? "published",
  differences: Array(s.differences ?? 0).fill({}),
  unpublished: s.unpublished,
});

describe("kindsOf", () => {
  it("says which filters an item matches", () => {
    expect(kindsOf(status({ status: "localOnly" }))).toEqual(["notInCanvas"]);
    expect(kindsOf(status({ status: "incomplete", differences: 2, unpublished: true }))).toEqual(["needsSync", "unpublished"]);
    expect(kindsOf(status({}))).toEqual([]);
  });
});

describe("shown", () => {
  it("shows everything with no filter on", () => {
    expect(shown([], [])).toBe(true);
  });

  it("shows an item that matches any filter that's on", () => {
    expect(shown(["needsSync", "unpublished"], ["unpublished"])).toBe(true);
    expect(shown([], ["notInCanvas"])).toBe(false);
  });
});

describe("toggleAll", () => {
  it("checks the rest when not all of them are checked", () => {
    expect(toggleAll({ a: 1, x: 9 }, { a: 1, b: 2 })).toEqual({ a: 1, b: 2, x: 9 });
  });

  it("unchecks exactly them when all are checked, leaving the others", () => {
    expect(toggleAll({ a: 1, b: 2, x: 9 }, { a: 1, b: 2 })).toEqual({ x: 9 });
  });

  it("changes nothing when there are none", () => {
    expect(toggleAll({ x: 9 }, {})).toEqual({ x: 9 });
  });
});

describe("updateEach", () => {
  it("updates the items one at a time, reporting progress", async () => {
    const order: string[] = [];
    const progress = vi.fn();

    await updateEach(["a", "b"], async (item) => void order.push(item), progress);

    expect(order).toEqual(["a", "b"]);
    expect(progress.mock.calls).toEqual([[1], [2]]);
  });

  it("goes on past an item that fails, and says which failed", async () => {
    const failed = await updateEach(
      ["a", "b", "c"],
      async (item) => {
        if (item === "b") throw new Error("Canvas said no");
      },
      () => {},
    );

    expect(failed).toEqual(["b"]);
  });
});
