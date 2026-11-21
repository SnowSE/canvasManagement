/**
 * The rules for how the row of panes gives way and comes back, in one place.
 * Every way of resizing is one of the functions here: a bar or a resize
 * square dragged (dragEdge), the narrowest box (resize), a double-click on
 * a title (growOrShrink), opening panes (openPanes), the window changing
 * (fit). Each turns the row as it is, and what earlier cascades displaced,
 * into the row as it should be and what is now displaced, so it can come
 * back as room returns.
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
 * Up to `need` px taken from the slabs `side` (nearest the edge first), as
 * the rules say; what the collapses free past `need` becomes empty room at
 * `end`. Changes `layout` and `effects`; returns what it took.
 */
function giveWay(layout: Layout, side: Slab[], need: number, end: End, effects: Effect[]): number {
  // the empty room at that end first (below zero, the row is too wide: more is needed)
  let got = Math.min(need, layout[end]);
  layout[end] -= got;
  const collapse = (s: Slab) => {
    effects.push({ id: s.id, kind: "collapse", width: s.width });
    s.collapsed = true;
    got += s.width - layout.bar;
  };
  for (const s of side.filter(open)) {
    const t = Math.min(need - got, s.width - s.minWidth);
    if (t <= 0) continue;
    effects.push({ id: s.id, kind: "narrow", width: s.width });
    s.width -= t;
    got += t;
    // within half a pixel: widths on the page are fractions, limits whole pixels
    if (s.width <= layout.least + 0.5) collapse(s);
  }
  for (const s of [...side].reverse().filter(open)) if (got < need) collapse(s);
  const hide = (s: Slab) => {
    effects.push({ id: s.id, kind: "hide", width: s.width });
    s.hidden = true;
    got += layout.bar + layout.gap;
  };
  for (const s of [...side].reverse().filter((s) => !s.hidden)) if (got < need) hide(s);
  layout[end] += Math.max(got - need, 0);
  return Math.min(got, need);
}

/** `amount` px handed to the open slabs `side`, nearest first, each up to its widest; the rest is empty room at `end`. */
function grow(layout: Layout, side: Slab[], amount: number, end: End) {
  for (const s of side.filter(open)) {
    const t = Math.max(Math.min(amount, s.maxWidth - s.width), 0);
    s.width += t;
    amount -= t;
  }
  layout[end] += amount;
}

/** The slabs either side of the edge before `slabs[edge]`, nearest first: the side `d` moves toward gives way, the other grows; and the end of the row each side has. */
function sides(slabs: Slab[], edge: number, d: number): { giving: Slab[]; growing: Slab[]; givingEnd: End; growingEnd: End } {
  const before = slabs.slice(0, edge).reverse();
  const after = slabs.slice(edge);
  return d >= 0 ? { giving: after, growing: before, givingEnd: "free", growingEnd: "lead" } : { giving: before, growing: after, givingEnd: "lead", growingEnd: "free" };
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
  const { giving, growing, givingEnd, growingEnd } = sides(next.slabs, edge, d);
  const got = giveWay(next, giving, Math.abs(d), givingEnd, effects);
  grow(next, growing, got, growingEnd);
  return { layout: next, effects, moved: Math.sign(d) * got };
}

/**
 * `need` px (Infinity: all there is) more for the slabs `keep` (side by
 * side): taken from the side after them first, then from the side before
 * them (see giveWay); `got` is what they get. The caller widens them.
 */
export function makeRoom(layout: Layout, keep: string[], need: number) {
  const next = copy(layout);
  const effects: Effect[] = [];
  const first = next.slabs.findIndex((s) => keep.includes(s.id));
  const last = next.slabs.findLastIndex((s) => keep.includes(s.id));
  const after = giveWay(next, next.slabs.slice(last + 1), need, "free", effects);
  const before = giveWay(next, next.slabs.slice(0, first).reverse(), need - after, "lead", effects);
  return { layout: next, effects, got: after + before };
}

/** A row as the rules leave it: the layout and what cascades displaced, waiting for room to come back. */
export type Changed = { layout: Layout; records: Effect[] };

/**
 * The pane `id` grown by `d` px (Infinity: as wide as the row can make it;
 * shrunk when negative) by the cascade: room from the others (see
 * makeRoom), and empty room brings back what cascades displaced (see
 * restore).
 */
export function resize(layout: Layout, id: string, d: number, records: Effect[]): Changed {
  const made = makeRoom(layout, [id], Math.max(d, 0));
  const shrink = Math.min(d, 0);
  const slabs = made.layout.slabs.map((s) => (s.id === id ? { ...s, width: s.width + made.got + shrink } : s));
  return restore({ ...made.layout, slabs, free: made.layout.free - shrink }, [...records, ...made.effects]);
}

/**
 * The panes `ids` open (a hidden one's bar back on the page too), each at
 * its width but at least its narrowest, room made for them together (see
 * makeRoom). Undefined: they are open already.
 */
export function openPanes(layout: Layout, ids: string[], records: Effect[]): Changed | undefined {
  const opening = layout.slabs.filter((s) => ids.includes(s.id) && !open(s));
  if (!opening.length) return;
  const wanted = (s: Slab) => Math.max(s.width, s.minWidth);
  // a collapsed pane's bar is on the page already; a hidden one needs its bar's room and a gap too
  const need = opening.reduce((sum, s) => sum + wanted(s) + (s.hidden ? layout.gap : -layout.bar), 0);
  const opened = { ...layout, slabs: layout.slabs.map((s) => (opening.includes(s) ? { ...s, width: wanted(s), collapsed: false, hidden: false } : s)) };
  const made = makeRoom(opened, ids, need);
  return { layout: made.layout, records: [...records, ...made.effects] };
}

/**
 * The row fitted to its room after anything changed it: wider than the
 * room (`free` below zero, past a pixel of rounding), the first open pane
 * keeps its width and the rest give way (see makeRoom), a narrowing of a
 * pane never sized (`sized` false: the default fitting the window) not
 * remembered; otherwise what was displaced comes back into the room the
 * window `gained` since (see restore), never into empty room a drag left.
 * Undefined: nothing to change.
 */
export function fit(layout: Layout, records: Effect[], sized: (id: string) => boolean, gained: number): Changed | undefined {
  if (layout.free >= -1) {
    const spare = Math.min(Math.max(gained, 0), layout.free);
    const back = restore({ ...layout, free: spare }, records);
    if (back.records.length === records.length && back.layout.free === spare) return;
    return { ...back, layout: { ...back.layout, free: back.layout.free + layout.free - spare } };
  }
  const first = layout.slabs.find(open);
  if (!first) return;
  const made = makeRoom(layout, [first.id], 0);
  return { layout: made.layout, records: [...records, ...made.effects.filter((e) => e.kind !== "narrow" || sized(e.id))] };
}

/**
 * A double-click on an open pane's title: the pane as wide as its widest
 * (as wide as the row can make it when it is already wider than that, past
 * a pixel of rounding), by the cascade (see resize); already that wide,
 * back to its narrowest, and what the cascade displaced comes back.
 */
export function growOrShrink(layout: Layout, id: string, records: Effect[]): Changed | undefined {
  const pane = layout.slabs.find((s) => s.id === id);
  if (!pane || !open(pane)) return;
  const grown = resize(layout, id, pane.width > pane.maxWidth + 1 ? Infinity : pane.maxWidth - pane.width, records);
  const got = grown.layout.slabs.find((s) => s.id === id)!.width - pane.width;
  return got >= 1 ? grown : resize(layout, id, pane.minWidth - pane.width, records);
}

/**
 * What cascades displaced (`records`, in the order they happened), undone,
 * last first, with the empty room at the row's `end` (its right end unless
 * given), as far as it goes: a bar comes back when it fits, a collapsed pane reopens when the
 * width it had (at least its narrowest) fits, a narrowed pane widens with
 * what there is. A record that no longer applies (the pane is gone, or
 * already back) is dropped.
 */
export function restore(layout: Layout, records: Effect[], end: End = "free"): Changed {
  const next = copy(layout);
  const left = [...records];
  for (let r = left.at(-1); r; r = left.at(-1)) {
    const s = next.slabs.find((x) => x.id === r!.id);
    if (!s || !{ hide: s.hidden, collapse: s.collapsed, narrow: open(s) && s.width < r.width }[r.kind]) {
      left.pop();
      continue;
    }
    const reopened = Math.max(r.width, s.minWidth);
    const cost = { hide: layout.bar + layout.gap, collapse: reopened - layout.bar, narrow: Math.min(r.width - s.width, next[end]) }[r.kind];
    if (cost > next[end] || cost <= 0) break;
    next[end] -= cost;
    if (r.kind === "hide") s.hidden = false;
    else if (r.kind === "collapse") Object.assign(s, { collapsed: false, width: reopened });
    else s.width += cost;
  }
  return { layout: next, records: left };
}

/** The narrowest and widest width set for each pane (undefined: not set). */
export type Limits = Record<string, { min?: number; max?: number }>;
/** The row as a drag finds or leaves it: the layout, what cascades displaced, the limits set. */
export type Row = Changed & { limits: Limits };
/** A drag let go: by which handle (`key`), the row it began from, how far its edge got, the row it left. */
export type LetGo = { key: string; start: Row; moved: number; left: Row };

/**
 * A drag of the edge before `slabs[edge]` (`slabs.length`: the row's right
 * end), `d` px from where it was in `start` (see pushEdge). Every step is
 * worked out from `start`, so dragging back undoes, step by step, what
 * dragging on did, and the edge stays under the pointer: what earlier
 * cascades did to the panes it pushes is forgotten (they are pushed
 * again), and the room it leaves at the other end brings back what they
 * did on that side. From a resize square for the pane `relaxed`, the limits are
 * lifted: the panes on the side giving way may go below their narrowest,
 * down to `least` (where they collapse), and `relaxed` past its widest; a
 * pane left open past a limit moves that limit to where it ended. `moved`:
 * how far the edge got, where a drag picked up again carries on from.
 */
export function dragEdge(start: Row, edge: number, d: number, relaxed?: string) {
  const { layout } = start;
  const { giving, growingEnd } = sides(layout.slabs, edge, d);
  const lift = (s: Slab) => ({ ...s, minWidth: giving.includes(s) ? layout.least : s.minWidth, maxWidth: s.id === relaxed ? Infinity : s.maxWidth });
  const pushed = pushEdge(relaxed === undefined ? layout : { ...layout, slabs: layout.slabs.map(lift) }, edge, d);
  const limits = { ...start.limits };
  pushed.layout.slabs.forEach((s, i) => {
    const was = layout.slabs[i];
    if (open(s) && s.width < was.minWidth) limits[s.id] = { ...limits[s.id], min: Math.round(s.width) };
    if (open(s) && s.width > was.maxWidth) limits[s.id] = { ...limits[s.id], max: Math.round(s.width) };
    Object.assign(s, { minWidth: was.minWidth, maxWidth: was.maxWidth });
  });
  const back = restore(pushed.layout, start.records.filter((r) => !giving.some((s) => s.id === r.id)), growingEnd);
  return { left: { layout: back.layout, records: [...back.records, ...pushed.effects], limits }, moved: pushed.moved };
}

// what must match exactly for a drag to carry on (the panes' states, what is displaced, the limits), and what may be off by rounding (the sizes)
const shape = (r: Row) => JSON.stringify([r.layout.slabs.map((s) => [s.id, s.collapsed, s.hidden]), r.records, r.limits]);
const sizes = (l: Layout) => [l.lead, l.free, ...l.slabs.map((s) => s.width)];

/** Picked up again by the handle `key`, the row being `now`: the drag `last` let go carries on, unless anything else has changed the row since (but for rounding: each width is saved to the pixel). */
export const carriesOn = (last: LetGo | null, key: string, now: Row): last is LetGo =>
  last?.key === key && shape(last.left) === shape(now) && sizes(last.left.layout).every((n, i) => Math.abs(n - sizes(now.layout)[i]) < 4);
