import { describe, expect, it } from "vitest";
import { getModuleItemUrl } from "@/services/urlUtils";
import { currentItemFromPath } from "./currentItem";
import { unpublishedOnly } from "./itemKind";
import { CHECKING, statusesOf } from "./itemKindRules";
import { itemKinds } from "./itemKinds";
import type { ItemSyncStatus } from "./calendar/day/getAssignmentSyncStatus";

const item = (name: string, dueAt = "") => ({ name, dueAt });
const inSync: ItemSyncStatus = { status: "published", message: "", differences: [] };

describe("how items stand against Canvas", () => {
  const answered = { assignment: () => inSync, quiz: () => inSync, page: () => inSync };
  it("an item's standing is its own kind's comparison of it", () => {
    const { statusOf } = statusesOf({ ...answered, page: (page, moduleName) => ({ ...inSync, message: `${page.name} in ${moduleName}` }) });
    expect(statusOf("page", item("Day 2"), "Week 1").message).toBe("Day 2 in Week 1");
    expect(statusOf("quiz", item("Quiz 1"), "Week 1")).toBe(inSync);
  });
  it("nothing is claimed of an item until Canvas has answered for its kind", () => {
    const { statusOf, ready } = statusesOf({ ...answered, quiz: undefined });
    expect(statusOf("quiz", item("Quiz 1"), "Week 1")).toBe(CHECKING);
    expect(statusOf("page", item("Day 2"), "Week 1")).toBe(inSync);
    expect(ready).toBe(false);
  });
  it("is ready once Canvas has answered for every kind", () => {
    expect(statusesOf(answered).ready).toBe(true);
  });
});

describe("every kind of item", () => {
  it.each(Object.keys(itemKinds))("a %s's address opens it", (kind) => {
    const url = getModuleItemUrl("Survey", "7 - Arrays", kind as keyof typeof itemKinds, "K & J.html");
    expect(currentItemFromPath(url)).toEqual({ kind: "item", moduleName: "7 - Arrays", type: kind, name: "K & J.html" });
  });
  it("is deleted from Canvas in bulk only while it is there unpublished", () => {
    expect(unpublishedOnly({ id: 7, published: false }, "Lab 1")).toEqual({ id: 7, published: false });
    expect(() => unpublishedOnly({ id: 7, published: true }, "Lab 1")).toThrow("Lab 1 isn't unpublished in Canvas, so it stays");
    expect(() => unpublishedOnly(undefined, "Lab 1")).toThrow("so it stays");
  });
});
