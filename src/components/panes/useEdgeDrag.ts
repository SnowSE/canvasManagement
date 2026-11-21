"use client";
import { useRef } from "react";
import { carriesOn, dragEdge, Layout, LetGo, resize, Row } from "./cascade";
import { usePanes } from "./PaneStrip";
import { measureLayout, paneElement } from "./measureRow";
import { widthRule } from "./paneStore";

/** The width rule onto a pane's element; the widths are applied imperatively (see Pane). */
export const applyWidth = (el: HTMLElement, pane: { minWidth: number; width: number }, place: number) => {
  const rule = widthRule(pane, place);
  el.style.flex = rule.flex;
  el.style.minWidth = rule.minWidth;
  el.style.maxWidth = rule.maxWidth;
};

// the last drag let go, for one picked up again to carry on (see carriesOn)
let last: LetGo | null = null;

/**
 * A drag that resizes the row: a bar (the edge before its pane), the bars
 * at either end, a resize square, or the narrowest box, worked out by the
 * rules (see dragEdge, resize), shown live (see usePanes().preview) and
 * written to the layout on release. Letting go and picking the same handle
 * up again is the same drag, until anything else changes the row.
 */
export function useRowDrag() {
  const { panes, lead, preview, save, records } = usePanes();
  const drag = useRef<{ key: string; start: Row; from: number; left?: Row; moved: number; relaxed?: string } | null>(null);
  const begin = (key: string, relaxed?: string) => {
    if (drag.current) return drag.current;
    const limits = Object.fromEntries(panes.map((p) => [p.id, { min: p.minWidth === p.floor ? undefined : p.minWidth, max: Number.isFinite(p.maxWidth) ? p.maxWidth : undefined }]));
    const now: Row = { layout: measureLayout(panes, lead), records, limits };
    const on = carriesOn(last, key, now) ? last! : { start: now, moved: 0 };
    return (drag.current = { key, start: on.start, from: on.moved, moved: on.moved, relaxed });
  };
  const show = (left: Row) => {
    drag.current!.left = left;
    preview(left.layout);
  };
  return {
    /** Moves the edge before `panes[from]` (`panes.length`: the row's right end) `dx` px; from a resize square for the pane `relaxed` (see dragEdge). */
    edge: (from: number, dx: number, relaxed?: string) => {
      const d = begin(`${from}:${relaxed ?? ""}`, relaxed);
      const step = dragEdge(d.start, from, d.from + dx, relaxed);
      d.moved = step.moved;
      show(step.left);
    },
    /** The pane `id` `width` wide by the cascade (the narrowest box dragged past the pane's width, or back); how wide it got. */
    resize: (id: string, width: number) => {
      const { layout, records, limits } = begin(`min:${id}`).start;
      const now = layout.slabs.find((s) => s.id === id)?.width ?? width;
      const result = resize(layout, id, width - now, records);
      show({ ...result, limits });
      return result.layout.slabs.find((s) => s.id === id)?.width ?? now;
    },
    /** The drag over: what it showed, written to the layout as it is, with the limits a resize square moved. */
    end: () => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      if (!d.left) return preview(null);
      last = { key: d.key, start: d.start, moved: d.moved, left: d.left };
      save(d.left.layout, d.left.records, d.relaxed ? d.left.limits : undefined);
    },
  };
}

/** Shows `layout`'s widths on the page without writing them, straight onto the panes' elements (Pane shows what is collapsed or hidden). */
export function showWidths(layout: Layout) {
  const spacer = document.querySelector<HTMLElement>("[data-pane-lead]");
  if (spacer) {
    spacer.style.width = `${layout.lead}px`;
    spacer.style.marginRight = layout.lead > 0 ? "0" : "-0.125rem";
  }
  layout.slabs.forEach((s, place) => {
    const el = paneElement(s.id);
    if (el && !s.collapsed && !s.hidden) applyWidth(el, { minWidth: 0, width: s.width }, place);
  });
}
