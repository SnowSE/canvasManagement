import { viewOf } from "@/components/panes/paneStore";

// the views whose content needs the calendar's width: its week grid, and the side-by-side tables of Compare and Import
const wide = new Set(["calendar", "compare", "import"]);

/** How narrow a pane may be made unless the user set it otherwise: the calendar's narrowest (`calendarMin`) for the views that need it, half that for the rest. */
export const defaultMinWidth = (id: string, calendarMin: number) => (wide.has(viewOf(id)) ? calendarMin : Math.round(calendarMin / 2));
