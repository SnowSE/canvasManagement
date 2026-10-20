import { describe, it, expect } from "vitest";
import { toggleAll } from "./toggleAll";

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
