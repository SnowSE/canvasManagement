import { PaneDoc, viewOf } from "./paneStore";

/**
 * A layout in an address (`?panes=m.,c.,e600:300:900,v500`), so a link can
 * say which panes its page opens with: the panes in row order, separated
 * by commas, each the letter of its view, a `.` when it starts collapsed,
 * then its width and, after colons, the narrowest and widest it may be
 * made, in px, each optional (`e:300` is a narrowest alone, `v400::800` a
 * width and a widest). A view named twice is there twice. Panes not named
 * are off the page. Nothing here knows which views there are: the page
 * gives each its letter.
 */
export type LinkedPane = { view: string; collapsed: boolean; width?: number; min?: number; max?: number };

const pane = /^([a-z])(\.?)(\d+)?(?::(\d+)?)?(?::(\d+))?$/;
const size = (digits?: string) => (digits === undefined ? undefined : Number(digits));

/** The panes an address's layout names; undefined when it is not a layout (a letter no view has, anything misspelt): the page then opens as it would without one. */
export function parseLayout(text: string, viewOfLetter: Record<string, string>): LinkedPane[] | undefined {
  const panes = text.split(",").map((part): LinkedPane | undefined => {
    const [, letter, dot, width, min, max] = pane.exec(part) ?? [];
    // a colon with nothing after it at all says nothing
    if (!viewOfLetter[letter] || part.endsWith(":")) return undefined;
    const sizes = { width: size(width), min: size(min), max: size(max) };
    return { view: viewOfLetter[letter], collapsed: dot === ".", ...Object.fromEntries(Object.entries(sizes).filter(([, px]) => px !== undefined)) };
  });
  return panes.every((p) => p !== undefined) ? panes : undefined;
}

/** A layout as an address has it (see parseLayout). */
export function formatLayout(panes: LinkedPane[], viewOfLetter: Record<string, string>): string {
  const letterOf = Object.fromEntries(Object.entries(viewOfLetter).map(([letter, view]) => [view, letter]));
  return panes
    .map((p) => {
      const limits = p.max !== undefined ? `:${p.min ?? ""}:${p.max}` : p.min !== undefined ? `:${p.min}` : "";
      return `${letterOf[p.view]}${p.collapsed ? "." : ""}${p.width ?? ""}${limits}`;
    })
    .join(",");
}

/** The pane each of a layout's panes is, in order: its view's own, or for a view named again its next copy (`editor#2`). */
export function linkedIds(linked: LinkedPane[]): string[] {
  const ids: string[] = [];
  for (const { view } of linked) {
    const copies = ids.filter((id) => viewOf(id) === view).length;
    ids.push(copies ? `${view}#${copies + 1}` : view);
  }
  return ids;
}

/**
 * The document for the row a layout asks for (`catalogue`: every view's
 * own pane): the named panes on the page in that order, as it says, a
 * view's second and later panes as its copies; every other pane off the
 * page with the width it had; the copies the row had before gone; and
 * nothing waiting to come back, since this row is the one asked for (what
 * doesn't fit the window gives way from there, see fit).
 */
export function layoutDoc(doc: PaneDoc, linked: LinkedPane[], catalogue: string[]): PaneDoc {
  const ids = linkedIds(linked);
  const rest = [...(doc.order ?? []), ...catalogue].filter((id, i, all) => catalogue.includes(id) && !ids.includes(id) && all.indexOf(id) === i);
  const kept = Object.fromEntries(rest.map((id) => [id, { ...doc.panes?.[id], hidden: true }]));
  const named = Object.fromEntries(linked.map(({ view: _view, ...state }, i) => [ids[i], { hidden: false, ...state }]));
  return { ...doc, order: [...ids, ...rest], panes: { ...kept, ...named }, added: ids.filter((id) => id.includes("#")), displaced: [], lead: 0 };
}
