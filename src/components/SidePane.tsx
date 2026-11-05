"use client";
import { ReactNode, RefObject, useRef } from "react";
import { clamp, ResizeHandle } from "./ResizeHandle";
import { HideContext } from "./panes/PaneHeader";
export { PaneHideProvider } from "./panes/PaneHeader";

// a remembered width is clamped too: an older build stored "dragged shut"
const minWidth = 200;

/**
 * A pane beside the page's main content (the editor's help, the calendar's
 * modules): on a wide window a column whose edge can be dragged, on a narrow
 * one a band above the content whose bottom edge can be dragged. The size is
 * remembered under `storageKey`.
 */
export function SidePane({
  storageKey,
  label,
  bodyRef,
  hidden = false,
  onHide,
  children,
}: {
  storageKey: string;
  label: string;
  bodyRef?: RefObject<HTMLDivElement | null> | ((el: HTMLDivElement | null) => void);
  /** Clipped away rather than unmounted, so it keeps its scroll and state. */
  hidden?: boolean;
  /** Clicking the pane's title hides it. */
  onHide?: () => void;
  children: ReactNode;
}) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={paneRef}
      className={
        "flex-none min-h-0 min-w-0 flex md:flex-row max-md:flex-col overflow-hidden " +
        (hidden
          ? "md:w-0! max-md:h-0!"
          : "md:w-[var(--pane-w,24rem)] md:max-w-[50%] max-md:h-[var(--pane-h,50vh)]")
      }
      inert={hidden}
    >
      <div ref={bodyRef} className="flex-1 min-w-0 min-h-0 overflow-y-auto">
        <HideContext.Provider value={onHide}>{children}</HideContext.Provider>
      </div>
      <ResizeHandle
        axis="col"
        className="max-md:hidden"
        target={paneRef}
        storageKey={storageKey}
        size={(e, rect) => clamp(e.clientX - rect.left, minWidth, window.innerWidth / 2)}
        apply={(pane, w) => pane.style.setProperty("--pane-w", `${Math.max(w, minWidth)}px`)}
        label={`resize ${label}`}
      />
      <ResizeHandle
        axis="row"
        className="md:hidden"
        target={paneRef}
        storageKey={`${storageKey}-height`}
        size={(e, rect) => clamp(e.clientY - rect.top, 80, window.innerHeight - 160)}
        apply={(pane, h) => pane.style.setProperty("--pane-h", `${h}px`)}
        label={`resize ${label}`}
      />
    </div>
  );
}

/** Shows or hides a pane; the same button in the same place on every page. */
export function PaneToggle({
  icon,
  label,
  open,
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={
        "unstyled btn-thin flex-none flex items-center gap-1 rounded border px-2 py-0.5 text-sm " +
        (open
          ? "border-blue-900 bg-blue-900/80 text-blue-50"
          : "border-slate-700 bg-transparent text-slate-400 hover:text-slate-200")
      }
      aria-pressed={open}
      title={`${open ? "Hide" : "Show"} ${label.toLowerCase()}`}
      onClick={onToggle}
    >
      {icon}
      <span className="max-sm:hidden">{label}</span>
    </button>
  );
}
