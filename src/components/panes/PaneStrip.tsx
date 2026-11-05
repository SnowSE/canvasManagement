"use client";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { remember, subscribeToStorage } from "../storage";
import {
  isShown,
  paneActions,
  PaneDoc,
  paneDocKey,
  PaneSpec,
  PaneView,
  parseDoc,
  showingPane,
  viewPanes,
} from "./paneStore";

export const paneElement = (id: string) => document.querySelector<HTMLElement>(`[data-pane="${id}"]`);

/** Every open pane's width as it is on the page right now. */
export const renderedWidths = (panes: PaneView[]) =>
  Object.fromEntries(panes.filter(isShown).map((p) => [p.id, paneElement(p.id)?.getBoundingClientRect().width ?? p.width]));

/**
 * The room shared out among the panes whose bars are on the page, for All:
 * what's left of the row once every bar has its width, in equal parts
 * (until min and max widths exist to share it by).
 */
function sharedWidths(panes: PaneView[]) {
  const shown = panes.filter((p) => !p.hidden);
  const row = shown.map((p) => paneElement(p.id)?.parentElement).find(Boolean);
  if (!row) return {};
  const bars = shown.reduce((sum, p) => sum + (paneElement(p.id)?.firstElementChild?.getBoundingClientRect().width ?? 0), 0);
  const gaps = row.clientWidth - [...row.children].reduce((sum, el) => sum + (el as HTMLElement).offsetWidth, 0);
  const each = (row.clientWidth - bars - Math.max(gaps, 0)) / shown.length;
  return Object.fromEntries(shown.map((p) => [p.id, Math.max(each, p.minWidth)]));
}

type Strip = {
  panes: PaneView[];
  /** A narrow window (a phone): one pane at a time, the first open one. */
  narrow: boolean;
  /** The pane showing on a narrow window. */
  showing?: string;
  pins: Record<string, boolean>;
  register: (spec: PaneSpec) => () => void;
  updateSpec: (spec: PaneSpec) => void;
  update: (change: (doc: PaneDoc) => PaneDoc) => void;
};

const StripContext = createContext<Strip>({
  panes: [],
  narrow: false,
  pins: {},
  register: () => () => {},
  updateSpec: () => {},
  update: () => {},
});

// Tailwind's md breakpoint: below it the panes stack and one shows at a time
const narrowQuery = "(max-width: 47.99rem)";
const subscribeToWidth = (onChange: () => void) => {
  const query = window.matchMedia(narrowQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const subscribeToNothing = () => () => {};

/**
 * The row of panes on a course page. Panes register themselves as they
 * mount; the strip reads the remembered document once per change, derives
 * every pane's view from it (see paneStore), and hands the views and the
 * actions on the document to the panes, the View menu and the phone's row.
 */
export function PaneStrip({ children }: { children: ReactNode }) {
  const [specs, setSpecs] = useState<PaneSpec[]>([]);
  const register = useCallback((spec: PaneSpec) => {
    setSpecs((current) => (current.some((s) => s.id === spec.id) ? current : [...current, spec]));
    return () => setSpecs((current) => current.filter((s) => s.id !== spec.id));
  }, []);
  // a changed flag replaces the spec in place, keeping the pane's position
  const updateSpec = useCallback((spec: PaneSpec) => {
    setSpecs((current) => current.map((s) => (s.id === spec.id ? spec : s)));
  }, []);
  const json = useSyncExternalStore(subscribeToStorage, () => localStorage.getItem(paneDocKey), () => null);
  // false on the server and while hydrating: the views then use what the server renders
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const narrow = useSyncExternalStore(subscribeToWidth, () => window.matchMedia(narrowQuery).matches, () => false);
  const panes = viewPanes(specs, parseDoc(json), hydrated);
  const update = useCallback((change: (doc: PaneDoc) => PaneDoc) => {
    remember(paneDocKey, JSON.stringify(change(parseDoc(localStorage.getItem(paneDocKey)))));
  }, []);
  // a mark that the panes have hydrated, for the browser checks
  useEffect(() => {
    document.documentElement.dataset.panesReady = "true";
  }, []);
  return (
    <StripContext.Provider
      value={{
        panes,
        narrow,
        showing: showingPane(panes),
        pins: parseDoc(json).pins ?? {},
        register,
        updateSpec,
        update,
      }}
    >
      {children}
    </StripContext.Provider>
  );
}

/** Shows a pane (expanded and on the page) from anywhere, a link outside the frame included. */
export const showPane = (id: string) =>
  remember(paneDocKey, JSON.stringify(paneActions.show(parseDoc(localStorage.getItem(paneDocKey)), id)));

/** The panes on the page and what can be done to them; for the panes themselves, the View menu and the phone's row. */
export function usePanes() {
  const { panes, narrow, showing, update } = useContext(StripContext);
  const ids = panes.map((p) => p.id);
  // a toggle keeps every open pane at the width it has (a pane the row had
  // squeezed stays as it was), so the toggle only shifts the others; on a
  // phone the widths are the screen's and aren't kept
  const frozen = (doc: PaneDoc) => (narrow ? doc : paneActions.setWidths(doc, renderedWidths(panes)));
  return {
    panes,
    narrow,
    showing,
    setHidden: (id: string, hidden: boolean) => update((d) => paneActions.setHidden(d, id, hidden)),
    setCollapsed: (id: string, collapsed: boolean) => update((d) => paneActions.setCollapsed(frozen(d), id, collapsed)),
    /** This pane open, the rest collapsed: on a phone, the one showing. */
    jumpTo: (id: string) => update((d) => paneActions.jumpTo(frozen(d), ids, id)),
    setAllCollapsed: (collapsed: boolean) => update((d) => paneActions.setAllCollapsed(frozen(d), ids, collapsed)),
    /** Every pane on the page open, the room shared out among them. */
    openAll: () => update((d) => paneActions.openAll(d, sharedWidths(panes))),
    setAllHidden: (hidden: boolean) => update((d) => paneActions.setAllHidden(d, ids, hidden)),
    setWidths: (widths: Record<string, number>) => update((d) => paneActions.setWidths(d, widths)),
    move: (id: string, index: number) => update((d) => paneActions.move(d, ids, id, index)),
    reset: () => update(paneActions.reset),
  };
}

/** Whether a bar stays at the top (the default) or is let go, by key; see PinButton. */
export function usePinned(key: string): [boolean, () => void] {
  const { pins, update } = useContext(StripContext);
  const pinned = pins[key] ?? true;
  return [pinned, () => update((d) => paneActions.setPinned(d, key, !pinned))];
}

/** A pane tells the strip about itself while it's mounted, and keeps its place as its flags change. */
export function usePaneRegistration(spec: PaneSpec) {
  const { register, updateSpec } = useContext(StripContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => register(spec), [spec.id, register]);
  useLayoutEffect(
    () => updateSpec(spec),
    // collapsedByDefault and icon are fresh each render; the spec is re-read when these change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.label, spec.minWidth, spec.defaultWidth, spec.ssr, updateSpec],
  );
}
