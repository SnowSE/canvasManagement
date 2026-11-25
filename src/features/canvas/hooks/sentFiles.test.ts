import { beforeEach, describe, expect, it } from "vitest";
import { sentFilesIn } from "./sentFiles";

const kept = new Map<string, string>();
const store = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
const sent = sentFilesIn(() => store);

describe("what this browser remembers of the files it sent to Canvas", () => {
  beforeEach(() => kept.clear());
  it("is the Canvas file and the hash sent, by Canvas course and the file's place", () => {
    sent.remember(42, "Week 1/files/koans.html", { id: 7, hash: "abc" });
    expect(sent.recall(42, "Week 1/files/koans.html")).toEqual({ id: 7, hash: "abc" });
    expect(sent.recall(43, "Week 1/files/koans.html")).toBeUndefined();
    expect(sent.recall(42, "Week 2/files/koans.html")).toBeUndefined();
  });
  it("goes with a file that is moved or renamed, and is no longer at its old place", () => {
    sent.remember(42, "Week 1/files/koans.html", { id: 7, hash: "abc" });
    sent.move(42, "Week 1/files/koans.html", "Week 2/files/k.html");
    expect(sent.recall(42, "Week 2/files/k.html")).toEqual({ id: 7, hash: "abc" });
    expect(sent.recall(42, "Week 1/files/koans.html")).toBeUndefined();
  });
  it("a file never sent moves with nothing, and takes over nothing remembered at its new place", () => {
    sent.remember(42, "Week 2/files/k.html", { id: 9, hash: "old" });
    sent.move(42, "Week 1/files/koans.html", "Week 2/files/k.html");
    expect(sent.recall(42, "Week 2/files/k.html")).toBeUndefined();
  });
  it("is nothing when what was kept can't be read", () => {
    kept.set("sentFile/42/Week 1/files/koans.html", "{not json");
    expect(sent.recall(42, "Week 1/files/koans.html")).toBeUndefined();
  });
});
