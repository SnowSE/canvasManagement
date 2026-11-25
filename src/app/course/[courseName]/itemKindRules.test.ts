import { describe, expect, it } from "vitest";
import { getModuleItemUrl } from "@/services/urlUtils";
import { currentItemFromPath } from "./currentItem";
import { unpublishedOnly } from "./itemKind";
import { arrangeItems, CHECKING, statusesOf } from "./itemKindRules";
import { itemKinds } from "./itemKinds";
import type { ItemSyncStatus } from "./calendar/day/getAssignmentSyncStatus";

const item = (name: string, dueAt = "") => ({ name, dueAt });
const inSync: ItemSyncStatus = { status: "published", message: "", differences: [] };

describe("a module's items, arranged for its list", () => {
  const items = [
    { type: "file" as const, item: item("style.css") },
    { type: "page" as const, item: item("Day 2", "09/02/2026 09:00:00") },
    { type: "quiz" as const, item: item("Quiz 1", "09/04/2026 09:00:00") },
    { type: "file" as const, item: item("k-koans.html") },
    { type: "assignment" as const, item: item("Lab 1", "09/01/2026 23:59:00") },
  ];
  it("assignments, quizzes and pages come together in date order, which is what Canvas's module holds", () => {
    expect(arrangeItems(items, itemKinds).dated.map((i) => i.item.name)).toEqual(["Lab 1", "Day 2", "Quiz 1"]);
  });
  it("files have no day: they are listed apart, under Files, as they came", () => {
    expect(arrangeItems(items, itemKinds).listed).toMatchObject([{ type: "file", title: "Files", items: [items[0], items[3]] }]);
  });
  it("a module with no files has no list of them", () => {
    expect(arrangeItems([items[1]], itemKinds).listed).toEqual([]);
  });
});

describe("how items stand against Canvas", () => {
  const answered = { assignment: () => inSync, quiz: () => inSync, page: () => inSync, file: () => inSync };
  it("an item's standing is its own kind's comparison of it", () => {
    const { statusOf } = statusesOf({ ...answered, page: (page, moduleName) => ({ ...inSync, message: `${page.name} in ${moduleName}` }) });
    expect(statusOf("page", item("Day 2"), "Week 1").message).toBe("Day 2 in Week 1");
    expect(statusOf("quiz", item("Quiz 1"), "Week 1")).toBe(inSync);
  });
  it("nothing is claimed of a file until Canvas's files have been read, whatever is known of the pages", () => {
    const { statusOf, ready } = statusesOf({ ...answered, file: undefined });
    expect(statusOf("file", item("style.css"), "Week 1")).toBe(CHECKING);
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
