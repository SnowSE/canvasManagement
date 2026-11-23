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
    // the start and end bars sit outside every pane: the empty room is what's
    // left before the end bar, and the room the panes share leaves both out
    const edgeBars = [...row.querySelectorAll<HTMLElement>("[data-pane-edge]")];
    gap = gapOf(row);
    const end = Math.max(...[...row.children].filter((el) => !edgeBars.includes(el as HTMLElement)).map((el) => el.getBoundingClientRect().right));
    const edges = edgeBars.reduce((total, el) => total + el.getBoundingClientRect().width + gap, 0);
    const collapsed = shown.find((p) => p.collapsed);
    const barEl = collapsed ? paneElement(collapsed.id) : paneElement(shown[0].id)?.firstElementChild;
    free = row.getBoundingClientRect().right - edges - end;
    bar = barEl?.getBoundingClientRect().width ?? bar;
    room = row.clientWidth - edges - gap * Math.max(shown.length - 1, 0);
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
