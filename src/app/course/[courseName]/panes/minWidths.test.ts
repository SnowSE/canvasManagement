import { describe, expect, it } from "vitest";
import { defaultMinWidth } from "./minWidths";

// the narrowest the calendar's week grid fits in
const calendarMin = 470;

describe("how narrow a pane may be made, unless set otherwise", () => {
  it.each(["calendar", "compare", "import"])("the %s: as narrow as the calendar's week grid allows, which its tables need too", (view) => {
    expect(defaultMinWidth(view, calendarMin)).toBe(470);
  });
  it.each(["editor", "preview", "modules", "help", "home", "history", "errors", "settings"])("the %s: half that", (view) => {
    expect(defaultMinWidth(view, calendarMin)).toBe(235);
  });
  it("a second pane of a view: as the view's own", () => {
    expect(defaultMinWidth("editor#2", calendarMin)).toBe(235);
    expect(defaultMinWidth("calendar#2", calendarMin)).toBe(470);
  });
});
