import { describe, expect, it } from "vitest";
import { byId, merge, remove, upsert } from "./cachedList";

const list = [
  { id: 1, name: "a" },
  { id: 2, name: "b" },
];

describe("a cached Canvas list after a change", () => {
  it("replaces the item Canvas sent back, in place", () => {
    expect(upsert(byId, { id: 1, name: "A" })(list)).toEqual([
      { id: 1, name: "A" },
      { id: 2, name: "b" },
    ]);
  });
  it("adds an item the list didn't have", () => {
    expect(upsert(byId, { id: 3, name: "c" })(list)).toEqual([...list, { id: 3, name: "c" }]);
  });
  it("lays an answer's fields over the item, keeping what the answer left out", () => {
    const withExtra = [{ id: 1, name: "a", overrides: [9] }];
    expect(merge(byId, { id: 1, name: "A" } as (typeof withExtra)[number])(withExtra)).toEqual([
      { id: 1, name: "A", overrides: [9] },
    ]);
  });
  it("drops a deleted item", () => {
    expect(remove(byId, 1)(list)).toEqual([{ id: 2, name: "b" }]);
  });
  it("leaves a list that was never fetched unfetched", () => {
    expect(upsert(byId, { id: 1, name: "A" })(undefined)).toBeUndefined();
    expect(remove(byId, 1)(undefined)).toBeUndefined();
  });
});
