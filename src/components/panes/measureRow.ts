"use client";
import { Layout } from "./cascade";
import { PaneView } from "./paneStore";

export const paneElement = (id: string) => document.querySelector<HTMLElement>(`[data-pane="${id}"]`);

const gapOf = (row: Element) => parseFloat(getComputedStyle(row).columnGap) || 0;

// how wide a scrollbar is here (0 where they overlay the content); once, it doesn't change
let scrollbar: number | undefined;
const scrollbarWidth = () => {
  if (scrollbar === undefined) {
    const probe = Object.assign(document.createElement("div"), { style: "position:absolute;visibility:hidden;overflow:scroll;width:100px" });
    document.body.append(probe);
    scrollbar = probe.offsetWidth - probe.clientWidth;
    probe.remove();
  }
  return scrollbar;
};

/** The narrowest an open pane may be: its bar, a scrollbar and as much content again, so it never looks collapsed. */
export const leastWidth = (bar: number) => bar + 2 * scrollbarWidth();

/**
 * The room a row has, from where its parts are on the page (all in px;
 * `panesRight` where the last thing in the row that is not an edge bar
 * ends; `bars` the widths of the row's start and end bars, 0 for none).
 * `free`: the empty room after the last pane, up to where the end bar sits
 * at the row's right end (below zero: the panes run past that). The start
 * bar takes none of it: it is left of the panes, behind where they end.
 * `shared`: what the panes have between them, the row less both bars, the
 * gap beside each and the gaps between the panes.
 */
export const rowRoom = ({ rowLeft, rowWidth, panesRight, bars, gap, shown }: { rowLeft: number; rowWidth: number; panesRight: number; bars: { start: number; end: number }; gap: number; shown: number }) => {
  const beside = (barWidth: number) => (barWidth ? barWidth + gap : 0);
  return {
    free: rowLeft + rowWidth - beside(bars.end) - panesRight,
    shared: rowWidth - beside(bars.start) - beside(bars.end) - gap * Math.max(shown - 1, 0),
  };
};

/**
 * The row as the rules see it (see cascade): every pane, the open ones at
 * their widths on the page; `lead` the room before the first. The only
 * place the sizing reads the page: everything it decides is from these
 * numbers, by the pure rules in cascade.
 */
export function measureLayout(panes: PaneView[], lead: number): Layout {
  const shown = panes.filter((p) => !p.hidden);
  const row = shown.map((p) => paneElement(p.id)?.parentElement).find(Boolean);
  let free = 0, bar = 23, gap = 0, room = Infinity;
  if (row) {
    const edgeBar = (end: "start" | "end") => row.querySelector<HTMLElement>(`[data-pane-edge="${end}"]`);
    const widthOf = (el: Element | null | undefined) => el?.getBoundingClientRect().width ?? 0;
    const inRow = [...row.children].filter((el) => el !== edgeBar("start") && el !== edgeBar("end"));
    gap = gapOf(row);
    const collapsed = shown.find((p) => p.collapsed);
    const barEl = collapsed ? paneElement(collapsed.id) : paneElement(shown[0].id)?.firstElementChild;
    bar = widthOf(barEl) || bar;
    ({ free, shared: room } = rowRoom({
      rowLeft: row.getBoundingClientRect().left,
      rowWidth: row.clientWidth,
      panesRight: Math.max(...inRow.map((el) => el.getBoundingClientRect().right)),
      bars: { start: widthOf(edgeBar("start")), end: widthOf(edgeBar("end")) },
      gap,
      shown: shown.length,
    }));
  }
  return {
    slabs: panes.map((p) => ({
      id: p.id,
      width: (!p.hidden && !p.collapsed && paneElement(p.id)?.getBoundingClientRect().width) || p.width,
      // a narrowest width set before the least there is now is the least
      minWidth: Math.max(p.minWidth, leastWidth(bar)),
      // a pane with no widest width set may take half the row
      maxWidth: Number.isFinite(p.maxWidth) ? p.maxWidth : room / 2,
      collapsed: p.collapsed,
      hidden: p.hidden,
    })),
    lead,
    free,
    bar,
    gap,
    least: leastWidth(bar),
  };
}
