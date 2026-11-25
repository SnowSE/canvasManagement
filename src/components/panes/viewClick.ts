/**
 * What a click on a view does, the same for a view icon on a bar and a
 * link to a view: a plain click does what that icon or link does by default
 * (`default`); Ctrl (Cmd on a Mac) puts the view in a pane of this window
 * (`pane`; with Shift too, at the end of the row: `paneAtEnd`); Shift
 * opens it in a window of its own, following this one (`window`). The
 * middle button is left to the browser (`browser`), as is the right-click
 * menu, so "open in a new tab" stays where it always is.
 */
export type ViewClick = "default" | "pane" | "paneAtEnd" | "window" | "browser";

export const viewClick = (e: { button: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): ViewClick => {
  if (e.button !== 0) return "browser";
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl) return e.shiftKey ? "paneAtEnd" : "pane";
  return e.shiftKey ? "window" : "default";
};
