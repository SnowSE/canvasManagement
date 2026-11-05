"use client";
import { ReactNode } from "react";
import { usePinned } from "./PaneStrip";
import { PinButton } from "./PinnedBars";

/**
 * The top of a pane whose content is sections: open/close all, a search box
 * across the pane's width, and whatever filters the pane has under them.
 * Pinned (the default) it stays at the top while the content scrolls; its
 * pin lets it scroll away. The pane's name is on its bar.
 */
export function PaneHeader({
  pin,
  setAllOpen,
  search,
  children,
}: {
  /** Remembered under this key, with what the pin's tooltip calls the header. */
  pin: { key: string; label: string };
  setAllOpen: (open: boolean) => void;
  search?: { label: string; value: string; onChange: (value: string) => void };
  children?: ReactNode;
}) {
  const [pinned] = usePinned(pin.key);
  return (
    <div
      className={
        "z-10 bg-gray-900 py-2 flex flex-col gap-1 border-b border-slate-800 text-sm " +
        (pinned ? "sticky top-0" : "")
      }
    >
      <div className="flex flex-row items-center gap-3">
        <button className={headerLink} onClick={() => setAllOpen(true)}>
          Expand all
        </button>
        <button className={headerLink} onClick={() => setAllOpen(false)}>
          Collapse all
        </button>
        <span className="ms-auto">
          <PinButton pin={pin.key} label={pin.label} />
        </span>
      </div>
      {search && (
        <label className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500">{search.label}</span>
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") search.onChange("");
            }}
            className="w-full rounded border border-slate-700 bg-gray-950 px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </label>
      )}
      {children}
    </div>
  );
}
const headerLink =
  "unstyled flex-none !px-1 !font-normal text-xs text-blue-400 hover:text-blue-300 underline";

/** The heading of a section in a pane: a triangle that turns when it's open, the title, anything on the right. */
export function SectionTitle({
  title,
  open,
  onClick,
  children,
}: {
  title: string;
  /** Left out for a <details>, whose open state the CSS reads (group-open). */
  open?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      // a narrow pane: the title keeps a readable width and what's on the right wraps under it
      className="cursor-pointer select-none py-2 font-semibold text-slate-200 hover:text-white flex flex-wrap items-center gap-2"
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <svg
        viewBox="0 0 16 16"
        className={
          "size-3 flex-none fill-slate-500 transition-transform group-open:rotate-90 " +
          (open ? "rotate-90" : "")
        }
        aria-hidden
      >
        <path d="M5 3l6 5-6 5z" />
      </svg>
      <span className="flex-1 min-w-32">{title}</span>
      {children}
    </div>
  );
}
