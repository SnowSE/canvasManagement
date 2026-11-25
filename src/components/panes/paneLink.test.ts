import { describe, expect, it } from "vitest";
import { formatLayout, layoutDoc, parseLayout } from "./paneLink";

const letters = { m: "modules", c: "calendar", e: "editor", v: "preview", h: "help" };
const parse = (text: string) => parseLayout(text, letters);

describe("a layout in an address: the panes in row order, by their letters", () => {
  it("a pane is its letter, a . when it starts collapsed, then its width, narrowest and widest", () => {
    expect(parse("m.,c.,e600:300:900,v500")).toEqual([
      { view: "modules", collapsed: true },
      { view: "calendar", collapsed: true },
      { view: "editor", collapsed: false, width: 600, min: 300, max: 900 },
      { view: "preview", collapsed: false, width: 500 },
    ]);
  });
  it("a collapsed pane keeps the width it opens to; a limit may be left out", () => {
    expect(parse("m.300,e:300,v400::800")).toEqual([
      { view: "modules", collapsed: true, width: 300 },
      { view: "editor", collapsed: false, min: 300 },
      { view: "preview", collapsed: false, width: 400, max: 800 },
    ]);
  });
  it("a view may be there more than once", () => {
    expect(parse("e,e")?.map((p) => p.view)).toEqual(["editor", "editor"]);
  });
  it.each(["", "z", "e600:", "e-5", "e600:300:900:1", "m.,,e", "editor", "e 600"])("anything else (%j) is no layout at all", (text) => {
    expect(parse(text)).toBeUndefined();
  });
  it("is written back as it reads", () => {
    for (const text of ["m.,c.,e600:300:900,v500", "m.300,e:300,v400::800", "e,e"]) expect(formatLayout(parse(text)!, letters)).toBe(text);
  });
});

describe("the row a layout asks for", () => {
  const catalogue = ["help", "modules", "calendar", "editor", "preview"];
  const was = { order: ["calendar", "modules"], pins: { "modules-header": true }, panes: { calendar: { width: 900 }, help: { width: 432, collapsed: false } }, displaced: [{ id: "help", kind: "hide" as const, width: 432 }] };
  const doc = layoutDoc(was, parse("m.,e600:300:900,e,v")!, catalogue);

  it("has the named panes in that order, a second pane of a view as its copy, then the rest as they were ordered", () => {
    expect(doc.order).toEqual(["modules", "editor", "editor#2", "preview", "calendar", "help"]);
    expect(doc.added).toEqual(["editor#2"]);
  });
  it("has each named pane on the page as the address says, with its sizes", () => {
    expect(doc.panes?.modules).toEqual({ hidden: false, collapsed: true });
    expect(doc.panes?.editor).toEqual({ hidden: false, collapsed: false, width: 600, min: 300, max: 900 });
    expect(doc.panes?.["editor#2"]).toEqual({ hidden: false, collapsed: false });
  });
  it("takes every other pane off the page, keeping the width it had", () => {
    expect(doc.panes?.calendar).toEqual({ width: 900, hidden: true });
    expect(doc.panes?.help).toEqual({ width: 432, collapsed: false, hidden: true });
  });
  it("starts afresh: nothing is waiting to come back, no room is held at the left; pins stay", () => {
    expect(doc).toMatchObject({ displaced: [], lead: 0, pins: { "modules-header": true } });
  });
  it("drops the copies the row had before", () => {
    expect(layoutDoc({ added: ["preview#2"], panes: { "preview#2": { width: 300 } }, order: ["preview#2"] }, parse("e")!, catalogue)).toMatchObject({ added: [], order: ["editor", "help", "modules", "calendar", "preview"] });
  });
});
