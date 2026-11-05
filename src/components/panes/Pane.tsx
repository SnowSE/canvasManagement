"use client";
import { CSSProperties, ReactNode, RefObject, useLayoutEffect, useRef, useState } from "react";
import { usePaneRegistration, usePanes } from "./PaneStrip";
import { HideButton, PaneBar } from "./PaneBar";
import { isShown, widthRule } from "./paneStore";

const paneElement = (id: string) => document.querySelector<HTMLElement>(`[data-pane="${id}"]`);
const applyWidth = (el: HTMLElement, pane: { minWidth: number; width: number }, place: number) => {
  const rule = widthRule(pane, place);
  el.style.flex = rule.flex;
  el.style.maxWidth = rule.maxWidth;
};

/**
 * A pane in the strip: a bar on its left edge, then its content with its
 * name across the top. Collapsed, only the bar shows. Clicking the bar or
 * the name collapses or expands the pane, and the bar stays where it is, so
 * a second click lands on it too. The bar sits between two panes, so
 * dragging it moves that edge: it sets the width of the pane to its left
 * (see widthRule for how the open panes share the row). On a narrow window
 * there are no bars: the panes share one spot, the first open one visible
 * and the others kept as they are, scroll included.
 */
export function Pane({
  id,
  label,
  icon,
  minWidth = 120,
  defaultWidth = 432,
  keepMounted = true,
  collapsedByDefault = () => false,
  ssr = false,
  bodyRef,
  children,
}: {
  id: string;
  label: string;
  /** For the phone's view row. */
  icon?: ReactNode;
  /** In px; the pane can't get narrower. */
  minWidth?: number;
  /** In px; the widest the pane gets until a drag sets it. */
  defaultWidth?: number;
  /** Keep the content while collapsed (scroll and state survive), or drop it (a heavy pane that fetches). */
  keepMounted?: boolean;
  /** Until the pane is first toggled (it can look at the window). */
  collapsedByDefault?: () => boolean;
  /** The server renders this pane expanded (the rest start collapsed until the remembered choices are known). */
  ssr?: boolean;
  bodyRef?: RefObject<HTMLDivElement | null> | ((el: HTMLDivElement | null) => void);
  children: ReactNode;
}) {
  usePaneRegistration({ id, label, icon, minWidth, defaultWidth, collapsedByDefault, ssr });
  const { panes, narrow, showing, setCollapsed, setHidden, setWidth } = usePanes();
  const place = panes.findIndex((p) => p.id === id);
  const view = panes[place];
  const remembered = view?.collapsed ?? !ssr;
  const selected = narrow && showing === id;
  const collapsed = narrow ? !selected : remembered;
  const toggle = () => setCollapsed(id, !remembered);
  const hide = () => setHidden(id, true);
  // the content is built the first time the pane is shown, then kept (scroll, state)
  const [built, setBuilt] = useState(!collapsed);
  if (!collapsed && !built) setBuilt(true);
  const mounted = built && (keepMounted || !collapsed);
  const paneRef = useRef<HTMLDivElement | null>(null);
  // the widths are applied imperatively: React keeps server-rendered
  // attributes during hydration, so a style from the document wouldn't reach the DOM
  const width = view?.width ?? defaultWidth;
  const hidden = view?.hidden ?? false;
  // re-applied when the pane comes back from hidden: that's a new element
  useLayoutEffect(() => {
    if (paneRef.current) applyWidth(paneRef.current, { minWidth, width }, place);
  }, [minWidth, width, place, hidden]);
  // while a bar is dragged, the pane to its left is resized live; the width is remembered on release
  const dragging = useRef<{ id: string; width: number } | null>(null);

  if (hidden) return null;
  return (
    <div
      ref={paneRef}
      // the panes sit in the order the user dragged them into (CSS order,
      // so the frame's markup needn't move)
      style={{ order: place } as CSSProperties}
      className={
        "min-w-0 min-h-0 flex md:flex-row " +
        // narrow: every pane in the same grid cell, the unselected ones
        // invisible but laid out, so they keep their scroll
        "max-md:flex-col max-md:[grid-area:1/1] " +
        (selected ? "" : "max-md:invisible ") +
        (collapsed ? "md:flex-none! md:max-w-none!" : "")
      }
      data-pane={id}
    >
      <PaneBar
        label={label}
        collapsed={collapsed}
        onToggle={toggle}
        onHide={hide}
        onDrag={(e) => {
          // the nearest open pane to the left, in the panes' order
          const left = panes.slice(0, place).reverse().find(isShown);
          const element = left && paneElement(left.id);
          if (!left || !element) return;
          const w = Math.max(e.clientX - element.getBoundingClientRect().left, left.minWidth);
          applyWidth(element, { minWidth: left.minWidth, width: w }, panes.indexOf(left));
          dragging.current = { id: left.id, width: w };
        }}
        onDragEnd={() => {
          if (dragging.current) setWidth(dragging.current.id, dragging.current.width);
          dragging.current = null;
        }}
      />
      <div
        className={"min-w-0 min-h-0 flex flex-col " + (collapsed && !narrow ? "flex-none md:w-0 overflow-hidden" : "flex-1")}
        inert={collapsed}
      >
        {!collapsed && (
          <div className="max-md:hidden flex-none flex flex-row items-center gap-2 border-b border-slate-800 text-xs font-semibold text-slate-300">
            <button className="unstyled flex-1 min-w-0 truncate text-left !px-1 !py-1 hover:text-white" title={`Collapse ${label}`} onClick={toggle}>
              {label}
            </button>
            <HideButton label={label} onHide={hide} />
          </div>
        )}
        <div ref={bodyRef} className="min-w-0 min-h-0 flex-1 flex flex-col overflow-y-auto">
          {mounted && children}
        </div>
      </div>
    </div>
  );
}
