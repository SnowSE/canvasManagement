import { describe, it, expect } from "vitest";
import { movePane, paneActions, PaneSpec, parseDoc, showingPane, viewPanes, widthRule } from "./paneStore";

const spec = (id: string, extra: Partial<PaneSpec> = {}): PaneSpec => ({
  id,
  label: id,
  minWidth: 120,
  defaultWidth: 400,
  collapsedByDefault: () => false,
  ssr: false,
  ...extra,
});
const specs = [
  spec("help", { collapsedByDefault: () => true }),
  spec("calendar", { defaultWidth: 1000, ssr: true }),
  spec("modules"),
  spec("editor"),
  spec("preview"),
];
const ids = specs.map((s) => s.id);

describe("viewPanes", () => {
  it("applies the defaults until a pane has been toggled, and before hydration expands only what the server renders", () => {
    const views = viewPanes(specs, {}, true);
    expect(views.map((v) => v.collapsed)).toEqual([true, false, false, false, false]);
    expect(viewPanes(specs, {}, false).map((v) => v.collapsed)).toEqual([true, false, true, true, true]);
    expect(viewPanes(specs, { panes: { help: { collapsed: false } } }, true).find((v) => v.id === "help")?.collapsed).toBe(false);
  });

  it("puts the remembered order first and the rest after, as they registered", () => {
    expect(viewPanes(specs, { order: ["preview", "help"] }, true).map((v) => v.id)).toEqual(["preview", "help", "calendar", "modules", "editor"]);
  });

  it("reads a broken document as empty", () => {
    expect(parseDoc("{not json")).toEqual({});
    expect(parseDoc(null)).toEqual({});
  });
});

describe("widthRule", () => {
  it("gives a pane its minimum, a share of the rest by how much more it could take, and a cap", () => {
    expect(widthRule({ minWidth: 120, width: 400 }, 0)).toEqual({ flex: "280 1 120px", maxWidth: "400px" });
    expect(widthRule({ minWidth: 120, width: 400 }, 2).flex).toBe("280 256 120px");
  });

  it("a pane dragged below its minimum keeps the minimum and no share of the rest", () => {
    expect(widthRule({ minWidth: 120, width: 100 }, 0)).toEqual({ flex: "0 1 120px", maxWidth: "120px" });
  });

  it("a pane's width is the dragged one, else its default", () => {
    const views = viewPanes(specs, { panes: { editor: { width: 650 } } }, true);
    expect(views.find((v) => v.id === "editor")?.width).toBe(650);
    expect(views.find((v) => v.id === "calendar")?.width).toBe(1000);
  });
});

describe("showingPane", () => {
  it("on a phone, the first open pane shows; with none open, the first on the page", () => {
    expect(showingPane(viewPanes(specs, {}, true))).toBe("calendar");
    expect(showingPane(viewPanes(specs, paneActions.jumpTo({}, ids, "editor"), true))).toBe("editor");
    expect(showingPane(viewPanes(specs, paneActions.setAllCollapsed({ panes: { help: { hidden: true } } }, ids, true), true))).toBe("calendar");
    expect(showingPane([])).toBeUndefined();
  });
});

describe("paneActions", () => {
  it("jumps to a pane: it expanded and on the page, the rest collapsed", () => {
    const doc = paneActions.jumpTo({ panes: { calendar: { hidden: true } } }, ids, "calendar");
    expect(doc.panes?.calendar).toEqual({ hidden: false, collapsed: false });
    expect(doc.panes?.editor?.collapsed).toBe(true);
  });

  it("moves a pane in the order, keeping the others", () => {
    expect(movePane(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(paneActions.move({}, ids, "preview", 1).order).toEqual(["help", "preview", "calendar", "modules", "editor"]);
  });

  it("reset forgets everything", () => {
    expect(paneActions.reset()).toEqual({});
  });
});
