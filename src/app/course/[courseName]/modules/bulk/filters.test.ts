import { describe, it, expect } from "vitest";
import { kindsOf, shown } from "./filters";

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
