"use client";
import { useRouterState } from "@tanstack/react-router";
import { usePanes } from "./PaneStrip";
import { copyTextToClipboard } from "../CopyableCommand";
import { useRowDrag } from "./useEdgeDrag";
import { barClass, ResizeSquare, Side, useDragHandlers } from "./PaneBar";
import { ViewChoice, ViewIcons } from "./ViewIcons";
import { isShown } from "./paneStore";
import { comingBack } from "./cascade";
import { paneElement } from "./measureRow";
import { openPopOut, popOutUrl } from "@/app/course/[courseName]/panes/popOut";

/**
 * The bar at either end of the row, with no pane of its own: the row's
 * left or right edge. Dragged, it moves the edge of the pane at that end
 * (into the empty room, or the room before the first pane, see withLead);
 * its resize square's inner half resizes that pane past its limits, the
 * outer half moves the edge as the bar does, a double-click makes the
 * pane's narrowest width its current width. Under the square, the views (see
 * ViewIcons): a click shows the view's first open pane where it is, or
 * expands its first pane, or opens a new one at this end of the row when
 * there is none (Ctrl-click: a new one regardless); Shift-click opens the
 * view in a new window following this one.
 */
export function EdgeBar({ end, views }: { end: "start" | "end"; views: ViewChoice[] }) {
  const { panes, narrow, records, setLimits, addPane, showView, close, restoreDefaults, layoutLink } = usePanes();
  const rowDrag = useRowDrag();
  const dragEdge = rowDrag.edge;
  const endDrag = rowDrag.end;
  const at = end === "start" ? 0 : panes.length;
  const handlers = useDragHandlers((e, x) => dragEdge(at, e.clientX - x), endDrag);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (narrow) return null;
  const shown = panes.filter(isShown);
  const pane = end === "start" ? shown[0] : shown[shown.length - 1];
  // the pane is on the row's inner side of this bar
  const inner: Side = end === "start" ? "right" : "left";
  const add = (view: string) => addPane(view, end === "start" ? 0 : undefined);
  // what gave way to a narrow window, in the words of what a wider one does
  const back = { narrow: "widens", collapse: "reopens", hide: "comes back" };
  const waiting = comingBack(records).map((r) => `${panes.find((p) => p.id === r.id)?.label ?? r.id} ${back[r.kind]}`);
  return (
    <div
      data-pane-edge={end}
      role="separator"
      aria-orientation="vertical"
      aria-label={`The row's ${end === "start" ? "left" : "right"} edge`}
      title={`Drag to resize the ${end === "start" ? "first" : "last"} pane within its limits (the square goes past them)`}
      style={{ order: end === "start" ? -2 : 9999 }}
      className={barClass + "touch-none cursor-col-resize border-slate-800 bg-gray-900 text-slate-300 hover:bg-slate-800/60"}
      {...handlers}
    >
      {pane && (
        <ResizeSquare
          sides={{ [inner]: pane.label }}
          onDrag={(e, x, side) => dragEdge(at, e.clientX - x, side === inner ? pane.id : undefined)}
          onDragEnd={endDrag}
          onReset={() => setLimits(pane.id, { min: Math.round(paneElement(pane.id)?.getBoundingClientRect().width ?? pane.width) })}
        />
      )}
      {end === "end" && waiting.length > 0 && (
        <span
          role="status"
          aria-label={`A wider window brings back ${waiting.length} pane${waiting.length === 1 ? "" : "s"}`}
          title={`This window is too narrow for the whole row. Wider, and: ${waiting.join(", ")}.`}
          className="flex-none cursor-help text-center text-[0.7em] leading-4 text-amber-300"
        >
          ⇥{waiting.length}
        </span>
      )}
      <ViewIcons
        views={views}
        hint={`show its pane (its first open one, else its first, expanded), or a new one at the ${end} of the row when there is none. Ctrl: a new one at the ${end}. Shift: in a new window following this one`}
        hrefOf={(view) => popOutUrl(pathname, view)}
        onPopOut={(view) => openPopOut(pathname, view)}
        onView={(view, e) => (e.shiftKey && !e.ctrlKey && !e.metaKey ? openPopOut(pathname, view, true) : e.ctrlKey || e.metaKey ? add(view) : showView(view, end))}
        menuSide={inner}
        drag={{ onDrag: (e, x) => dragEdge(at, e.clientX - x), onDragEnd: endDrag }}
        extras={[
          { label: "Close every pane", onClick: () => close(panes.map((p) => p.id)) },
          { label: "Restore the default layout", onClick: restoreDefaults },
          ...(layoutLink ? [{ label: "Copy a link to this layout", onClick: () => void copyTextToClipboard(`${location.origin}${location.pathname}?panes=${layoutLink()}`) }] : []),
        ]}
      />
    </div>
  );
}
