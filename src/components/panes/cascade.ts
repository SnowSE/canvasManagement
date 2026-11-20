/**
 * The rules for how the row of panes gives way and comes back, in one place.
 * Every way of resizing (a bar dragged, a resize square, the narrowest box,
 * a double-click on a title, opening a pane, a window made smaller) is one
 * of the functions here, each turning the row as it is into the row as it
 * should be, plus what it displaced, so it can come back as room returns.
 * Nothing here reads the page or the document: see measureRow and PaneStrip.
 *
 * The rules:
 * - Room is taken from one side of an edge: first the empty room at that
 *   side's end of the row, then the open panes on that side narrow to their
 *   narrowest, nearest the edge first, then they collapse to their bars,
 *   farthest first, then the bars leave the page, farthest first.
 * - Each of those effects is remembered; room released later (empty room at
 *   the row's right end) undoes them, last first, as far as it goes: bars
 *   come back, then panes reopen at the width they had, then narrowed panes
 *   widen back.
 * - No open pane is narrower than `least` (its bar, a scrollbar and as much
 *   content again, so it never looks collapsed): one narrowed to it
 *   collapses to its bar (only a resize square takes a pane below its
 *   narrowest).
 * - A resize square is a drag like any other, but the panes giving way may
 *   go below their narrowest, down to `least`, and its own pane past its
 *   widest; where they end becomes their new limits (see squareDrag). A
 *   plain drag keeps every pane within its limits.
 */

/** A pane in the row as the rules see it; `width` is its open width, also while collapsed or hidden. */
export type Slab = { id: string; width: number; minWidth: number; maxWidth: number; collapsed: boolean; hidden: boolean };
/** The row: every pane in order (hidden ones too), the empty room at each end, a collapsed pane's width (its bar), the space between bars, the narrowest an open pane may be. */
export type Layout = { slabs: Slab[]; lead: number; free: number; bar: number; gap: number; least: number };
/** One thing a cascade did to a pane, undone as room returns: narrowed from `width`, collapsed at `width`, or taken off the page. */
export type Effect = { id: string; kind: "narrow" | "collapse" | "hide"; width: number };
type End = "lead" | "free";

const open = (s: Slab) => !s.collapsed && !s.hidden;
const copy = (layout: Layout): Layout => ({ ...layout, slabs: layout.slabs.map((s) => ({ ...s })) });

/**
 * `need` px taken from the slabs `side` (nearest the edge first), as the
 * rules say; what the collapses free past `need` becomes empty room at
 * `end`. Changes `layout` and `effects`; returns what is still missing.
 */
function giveWay(layout: Layout, side: Slab[], need: number, end: End, effects: Effect[]): number {
  // the empty room at that end first (below zero, the row is too wide: more is needed)
  const take = Math.min(need, layout[end]);
  layout[end] -= take;
  need -= take;
  for (const s of side.filter(open)) {
    if (need <= 0) break;
    const t = Math.min(need, s.width - s.minWidth);
    if (t <= 0) continue;
    effects.push({ id: s.id, kind: "narrow", width: s.width });
    s.width -= t;
    need -= t;
    if (s.width <= layout.least + 0.5) {
      effects.push({ id: s.id, kind: "collapse", width: s.width });
      s.collapsed = true;
      need -= s.width - layout.bar;
    }
  }
  for (const s of [...side].reverse().filter(open)) {
    if (need <= 0) break;
    effects.push({ id: s.id, kind: "collapse", width: s.width });
    s.collapsed = true;
    need -= s.width - layout.bar;
  }
  for (const s of [...side].reverse().filter((s) => !s.hidden)) {
    if (need <= 0) break;
    effects.push({ id: s.id, kind: "hide", width: s.width });
    s.hidden = true;
    need -= layout.bar + layout.gap;
  }
  if (need < 0) layout[end] -= need;
  return Math.max(need, 0);
}

/** `amount` px handed to the open slabs `side`, nearest first, each up to its widest; the rest is empty room at `end`. */
function grow(layout: Layout, side: Slab[], amount: number, end: End) {
  for (const s of side.filter(open)) {
    if (amount <= 0) break;
    const t = Math.min(amount, s.maxWidth - s.width);
    if (t <= 0) continue;
    s.width += t;
    amount -= t;
  }
  layout[end] += Math.max(amount, 0);
}

/**
 * The edge before `slabs[edge]` (`slabs.length`: the row's right end) moved
 * `d` px (right when positive): the side it moves toward gives way (see
 * giveWay), the other side's open panes grow, nearest first, each to its
 * widest, and what they don't take is empty room at that end of the row;
 * `moved`: how far the edge got (short of `d` when nothing is left to give).
 */
export function pushEdge(layout: Layout, edge: number, d: number) {
  const next = copy(layout);
  const effects: Effect[] = [];
  const before = next.slabs.slice(0, edge).reverse();
  const after = next.slabs.slice(edge);
  const [giving, growing, givingEnd, growingEnd]: [Slab[], Slab[], End, End] = d >= 0 ? [after, before, "free", "lead"] : [before, after, "lead", "free"];
  const got = Math.abs(d) - giveWay(next, giving, Math.abs(d), givingEnd, effects);
  grow(next, growing, got, growingEnd);
  return { layout: next, effects, moved: Math.sign(d) * got };
}

/**
 * `need` px more for the slabs `keep` (side by side): taken from the side
 * after them first, then from the side before them (see giveWay); `got` is
 * what they get. The caller widens them. A double-click on a title, the
 * narrowest box past the pane's width, opening panes, and a row wider than
 * the window (need 0, `free` below zero: the first open pane keeps its width).
 */
export function makeRoom(layout: Layout, keep: string[], need: number) {
  const next = copy(layout);
  const effects: Effect[] = [];
  const first = next.slabs.findIndex((s) => keep.includes(s.id));
  const last = next.slabs.findLastIndex((s) => keep.includes(s.id));
  const after = next.slabs.slice(last + 1);
  const before = next.slabs.slice(0, Math.max(first, 0)).reverse();
  const short = giveWay(next, before, giveWay(next, after, need, "free", effects), "lead", effects);
  return { layout: next, effects, got: need - short };
}

/** The slab `id` `width` wide. */
function setWidth(layout: Layout, id: string, width: number): Layout {
  return { ...layout, slabs: layout.slabs.map((s) => (s.id === id ? { ...s, width } : s)) };
}

/**
 * The pane `id` grown by `d` px (shrunk when negative) by the cascade: room
 * from the others, or, shrinking, empty room that what cascades displaced
 * comes back into (see restore).
 */
export function resize(layout: Layout, id: string, d: number, records: Effect[]) {
  const pane = layout.slabs.find((s) => s.id === id);
  if (!pane) return { layout, records };
  if (d < 0) {
    const narrowed = setWidth(layout, id, pane.width + d);
    return restore({ ...narrowed, free: narrowed.free - d }, records);
  }
  const made = makeRoom(layout, [id], d);
  return { layout: setWidth(made.layout, id, pane.width + made.got), records: [...records, ...made.effects] };
}

/**
 * What cascades displaced (`records`, in the order they happened), undone,
 * last first, with the empty room at the row's right end, as far as it
 * goes: a bar comes back when it fits, a collapsed pane reopens when the
 * width it had fits, a narrowed pane widens with what there is. A record
 * that no longer applies (the pane is gone, or already back) is dropped;
 * `changed`: something came back.
 */
export function restore(layout: Layout, records: Effect[]) {
  const next = copy(layout);
  const left = [...records];
  let changed = false;
  while (left.length) {
    const r = left[left.length - 1];
    const s = next.slabs.find((x) => x.id === r.id);
    if (!s || (r.kind === "hide" && !s.hidden) || (r.kind === "collapse" && !s.collapsed) || (r.kind === "narrow" && (s.collapsed || s.hidden || s.width >= r.width))) {
      left.pop();
      continue;
    }
    if (r.kind === "hide" || (r.kind === "collapse" && s.hidden)) {
      if (r.kind !== "hide" || layout.bar + layout.gap > next.free) break;
      s.hidden = false;
      next.free -= layout.bar + layout.gap;
      changed = true;
    } else if (r.kind === "collapse") {
      const width = Math.max(r.width, s.minWidth);
      if (width - layout.bar > next.free) break;
      s.collapsed = false;
      s.width = width;
      next.free -= width - layout.bar;
      changed = true;
    } else {
      const t = Math.min(r.width - s.width, next.free);
      if (t <= 0) break;
      s.width += t;
      next.free -= t;
      changed = true;
      if (s.width < r.width) break;
    }
    left.pop();
  }
  return { layout: next, records: left, changed };
}

/**
 * A drag from a resize square for the pane `id` (the one on the square's
 * side of its bar): the edge pushed as any drag pushes it (see pushEdge),
 * but the panes on the side giving way may go below their narrowest, down
 * to `least` (where they collapse), and `id` past its widest; `limits`
 * are the narrowest and widest widths that moves, for the panes left open.
 */
export function squareDrag(layout: Layout, edge: number, d: number, id: string) {
  const giving = new Set((d >= 0 ? layout.slabs.slice(edge) : layout.slabs.slice(0, edge)).map((s) => s.id));
  const freed = { ...layout, slabs: layout.slabs.map((s) => ({ ...s, minWidth: giving.has(s.id) || s.id === id ? layout.least : s.minWidth, maxWidth: s.id === id ? Infinity : s.maxWidth })) };
  const pushed = pushEdge(freed, edge, d);
  const limits: Limits = {};
  // the limits as they were, and where the drag moved them
  const slabs = pushed.layout.slabs.map((s, i) => {
    const was = layout.slabs[i];
    const moved = !s.collapsed && !s.hidden ? limitsAfter(was, s.width) : {};
    if (moved.min !== undefined || moved.max !== undefined) limits[s.id] = moved;
    return { ...s, minWidth: was.minWidth, maxWidth: was.maxWidth };
  });
  return { layout: { ...pushed.layout, slabs }, effects: pushed.effects, moved: pushed.moved, limits };
}

/** After a drag from a resize square left the pane `width` wide: the limit it crossed, if any, moved to that width. */
export const limitsAfter = (pane: { minWidth: number; maxWidth: number }, width: number): { min?: number; max?: number } => ({
  ...(width < pane.minWidth ? { min: Math.round(width) } : {}),
  ...(width > pane.maxWidth ? { max: Math.round(width) } : {}),
});

/** The narrowest and widest width set for each pane (undefined: not set). */
export type Limits = Record<string, { min?: number; max?: number }>;
/** The row as a drag finds or leaves it: the layout, what cascades displaced, the limits set. */
export type Row = { layout: Layout; records: Effect[]; limits: Limits };
/** A drag let go: by which handle (`key`), the row it began from, how far its edge got, the row it left. */
export type LetGo = { key: string; start: Row; moved: number; left: Row };

/**
 * A drag of the edge before `slabs[edge]` (`slabs.length`: the row's right
 * end), `d` px from where it was in `start`; from a resize square for the
 * pane `relaxed`, past the limits (see squareDrag). Every step is worked
 * out from `start`, so dragging back undoes, step by step, what dragging on
 * did; room it frees brings back what earlier cascades displaced. `moved`:
 * how far the edge got, where a drag picked up again carries on from.
 */
export function dragEdge(start: Row, edge: number, d: number, relaxed?: string) {
  const square = relaxed ? squareDrag(start.layout, edge, d, relaxed) : undefined;
  const pushed = square ?? pushEdge(start.layout, edge, d);
  const back = restore(pushed.layout, start.records);
  const moved = square?.limits ?? {};
  const limits = Object.fromEntries(Object.entries(start.limits).map(([id, l]) => [id, { ...l, ...moved[id] }]));
  return { left: { layout: back.layout, records: [...back.records, ...pushed.effects], limits }, moved: pushed.moved };
}

/** Picked up again by the handle `key`, the row being `now`: the drag `last` let go carries on, unless anything else has changed the row since. */
export const carriesOn = (last: LetGo | null, key: string, now: Row): last is LetGo =>
  !!last &&
  last.key === key &&
  sameLayout(last.left.layout, now.layout) &&
  JSON.stringify(last.left.records) === JSON.stringify(now.records) &&
  Object.keys({ ...last.left.limits, ...now.limits }).every((id) => (last.left.limits[id]?.min ?? -1) === (now.limits[id]?.min ?? -1) && (last.left.limits[id]?.max ?? -1) === (now.limits[id]?.max ?? -1));

/** The same row, but for rounding (each width is saved to the pixel). */
const sameLayout = (a: Layout, b: Layout) =>
  a.slabs.length === b.slabs.length &&
  Math.abs(a.lead - b.lead) < 4 &&
  Math.abs(a.free - b.free) < 4 &&
  a.slabs.every((s, i) => {
    const t = b.slabs[i];
    return s.id === t.id && s.collapsed === t.collapsed && s.hidden === t.hidden && (s.collapsed || s.hidden || Math.abs(s.width - t.width) < 4);
  });
