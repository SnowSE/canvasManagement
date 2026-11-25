import { describe, expect, it } from "vitest";
import { viewClick } from "./viewClick";

const click = (keys: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; button?: number } = {}) =>
  viewClick({ ctrlKey: false, metaKey: false, shiftKey: false, button: 0, ...keys });

// One rule for every click on a view, whether a view icon on a bar or a link
// to a view (the error count, a footer's differences, Compare with Canvas in a menu).
describe("what a click on a view does", () => {
  it("a plain click: what that icon or link does by default", () => {
    expect(click()).toBe("default");
  });
  it("Ctrl, or Cmd on a Mac: a pane in this window", () => {
    expect(click({ ctrlKey: true })).toBe("pane");
    expect(click({ metaKey: true })).toBe("pane");
  });
  it("Ctrl+Shift: a pane in this window, at the end of the row", () => {
    expect(click({ ctrlKey: true, shiftKey: true })).toBe("paneAtEnd");
  });
  it("Shift: a window of its own, following this one", () => {
    expect(click({ shiftKey: true })).toBe("window");
  });
  it("the middle button: left to the browser, which opens a new tab", () => {
    expect(click({ button: 1 })).toBe("browser");
    expect(click({ button: 1, ctrlKey: true })).toBe("browser");
  });
});
