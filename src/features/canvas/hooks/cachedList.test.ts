import { describe, expect, it } from "vitest";
import { byId, remove, upsert } from "./cachedList";

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
  it("drops a deleted item", () => {
    expect(remove(byId, 1)(list)).toEqual([{ id: 2, name: "b" }]);
  });
  it("leaves a list that was never fetched unfetched", () => {
    expect(upsert(byId, { id: 1, name: "A" })(undefined)).toBeUndefined();
    expect(remove(byId, 1)(undefined)).toBeUndefined();
  });
});
