import { describe, it, expect } from "vitest";
import { byOrderingDate, canvasOrderDiffers } from "./moduleItemOrder";

const item = (name: string, dueAt: string, unlockAt?: string) => ({ name, dueAt, unlockAt });

describe("byOrderingDate", () => {
  it("orders by the available date when there is one, else the due date", () => {
    const items = [
      item("due first, opens late", "09/02/2026 23:59:00", "09/01/2026 00:00:00"),
      item("opens first", "09/09/2026 23:59:00", "08/31/2026 00:00:00"),
      item("no available date", "09/01/2026 12:00:00", ""),
    ];

    expect([...items].sort(byOrderingDate).map((i) => i.name)).toEqual([
      "opens first",
      "due first, opens late",
      "no available date",
    ]);
  });
});

describe("canvasOrderDiffers", () => {
  const items = [
    item("A", "09/01/2026 23:59:00"),
    item("B", "09/02/2026 23:59:00"),
    item("B2", "09/02/2026 23:59:00"),
    item("C", "09/03/2026 23:59:00"),
  ];

  it("is false when Canvas lists them in date order", () => {
    expect(canvasOrderDiffers(items, ["A", "B", "B2", "C"])).toBe(false);
  });

  it("ignores the order of items with the same date", () => {
    expect(canvasOrderDiffers(items, ["A", "B2", "B", "C"])).toBe(false);
  });

  it("ignores Canvas items the module's files don't have", () => {
    expect(canvasOrderDiffers(items, ["Welcome", "A", "B", "Link", "C"])).toBe(false);
  });

  it("is true when an item is out of date order", () => {
    expect(canvasOrderDiffers(items, ["B", "A", "C"])).toBe(true);
  });
});
