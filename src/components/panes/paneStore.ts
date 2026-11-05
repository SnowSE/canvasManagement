import { ReactNode } from "react";

/**
 * Everything a user has chosen about the panes, remembered as one document
 * in localStorage under `panes`: the order they dragged them into, which
 * bars are off the page, which panes are collapsed, their widths, and which
 * bars are pinned. Nothing here reads the document; PaneStrip does that
 * once and hands the derived views around.
 */
export type PaneDoc = {
  order?: string[];
  pins?: Record<string, boolean>;
  panes?: Record<string, { hidden?: boolean; collapsed?: boolean; width?: number }>;
};
export const paneDocKey = "panes";

export function parseDoc(json: string | null): PaneDoc {
  try {
    const doc = JSON.parse(json ?? "null");
    return doc && typeof doc === "object" ? doc : {};
  } catch {
    return {};
  }
}

/** What a pane says about itself when it registers with the strip. */
export type PaneSpec = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** The pane can't get narrower than this; see widthRule. */
  minWidth: number;
  /** The widest the pane gets until a drag sets it; see widthRule. */
  defaultWidth: number;
  /** Until the pane is first toggled; it can look at the window. */
  collapsedByDefault: () => boolean;
  /** The server renders this pane expanded; the rest start collapsed until the remembered choices are known. */
  ssr: boolean;
};

/** A pane as the page shows it: its spec with the user's choices applied; `width` is its max, dragged or default. */
export type PaneView = PaneSpec & { hidden: boolean; collapsed: boolean; width: number };

/** Panes in the remembered order, then the rest in the order they registered. */
export function orderPanes<T extends { id: string }>(panes: T[], order: string[] = []): T[] {
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  return panes
    .map((pane, i) => ({ pane, i }))
    .sort((a, b) => rank(a.pane.id) - rank(b.pane.id) || a.i - b.i)
    .map(({ pane }) => pane);
}

/** The panes with the document applied; before hydration, with what the server renders. */
export function viewPanes(specs: PaneSpec[], doc: PaneDoc, hydrated: boolean): PaneView[] {
  return orderPanes(specs, doc.order).map((spec) => {
    const saved = doc.panes?.[spec.id] ?? {};
    return {
      ...spec,
      hidden: saved.hidden ?? false,
      collapsed: saved.collapsed ?? (hydrated ? spec.collapsedByDefault() : !spec.ssr),
      width: saved.width ?? spec.defaultWidth,
    };
  });
}

export const isShown = (pane: PaneView) => !pane.hidden && !pane.collapsed;

/** On a narrow window, the pane that shows: the first open one, else the first on the page at all. */
export const showingPane = (panes: PaneView[]) => (panes.find(isShown) ?? panes.find((p) => !p.hidden))?.id;

/**
 * How the open panes share the row, as flexbox terms: every pane gets its
 * minimum, the rest of the room goes to them in proportion to how much
 * more each could take (max − min), and nobody passes its max. When there
 * isn't room for every minimum, the minimums are handed out from the left
 * (a shrink weight that climbs steeply with the pane's place, so the
 * rightmost gives way almost entirely before the next one starts to). Room
 * nobody can take stays empty, so closing a pane doesn't push its
 * neighbours around.
 */
export const widthRule = (pane: { minWidth: number; width: number }, place: number) => ({
  flex: `${Math.max(pane.width - pane.minWidth, 0)} ${16 ** place} ${pane.minWidth}px`,
  maxWidth: `${Math.max(pane.width, pane.minWidth)}px`,
});

/** `order` with `id` moved to `index`. */
export function movePane(order: string[], id: string, index: number): string[] {
  const rest = order.filter((x) => x !== id);
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}

const withPane = (doc: PaneDoc, id: string, change: NonNullable<PaneDoc["panes"]>[string]): PaneDoc => ({
  ...doc,
  panes: { ...doc.panes, [id]: { ...doc.panes?.[id], ...change } },
});

/** What the menu, the bars and the phone's row do to the document. */
export const paneActions = {
  setHidden: (doc: PaneDoc, id: string, hidden: boolean) => withPane(doc, id, { hidden }),
  setCollapsed: (doc: PaneDoc, id: string, collapsed: boolean) => withPane(doc, id, { collapsed }),
  /** Expanded and on the page. */
  show: (doc: PaneDoc, id: string) => withPane(doc, id, { hidden: false, collapsed: false }),
  /** This pane expanded and on the page, every other collapsed: on a phone, the one showing. */
  jumpTo: (doc: PaneDoc, ids: string[], id: string) =>
    withPane(
      ids.reduce((d, each) => withPane(d, each, { collapsed: each !== id }), doc),
      id,
      { hidden: false },
    ),
  setAllCollapsed: (doc: PaneDoc, ids: string[], collapsed: boolean) =>
    ids.reduce((d, id) => withPane(d, id, { collapsed }), doc),
  setAllHidden: (doc: PaneDoc, ids: string[], hidden: boolean) =>
    ids.reduce((d, id) => withPane(d, id, { hidden }), doc),
  setWidth: (doc: PaneDoc, id: string, width: number) => withPane(doc, id, { width }),
  move: (doc: PaneDoc, ids: string[], id: string, index: number) => ({ ...doc, order: movePane(ids, id, index) }),
  setPinned: (doc: PaneDoc, key: string, pinned: boolean) => ({ ...doc, pins: { ...doc.pins, [key]: pinned } }),
  /** Back to how the app starts. */
  reset: (): PaneDoc => ({}),
};
