"use client";
import { createContext, ReactNode, useContext } from "react";

// how the pane is hidden, for its header's title to call
export const HideContext = createContext<(() => void) | undefined>(undefined);

/** For pane content rendered from elsewhere (a portal), which the pane's own context can't reach. */
export function PaneHideProvider({ hide, children }: { hide?: () => void; children: ReactNode }) {
  return <HideContext.Provider value={hide}>{children}</HideContext.Provider>;
}

/**
 * The sticky top of a pane: its title with open/close all, and under them a
 * search box across the pane's width, so what's typed stays readable.
 */
export function PaneHeader({
  title,
  setAllOpen,
  search,
}: {
  title: string;
  setAllOpen: (open: boolean) => void;
  search?: { label: string; value: string; onChange: (value: string) => void };
}) {
  const hide = useContext(HideContext);
  return (
    <div className="sticky top-0 z-10 bg-gray-900 py-2 flex flex-col gap-1 border-b border-slate-800 text-sm">
      <div className="flex flex-row items-center gap-3">
        <h3 className="flex-1 font-bold text-slate-300">
          {hide ? (
            <button
              className="unstyled !p-0 !font-bold hover:text-white"
              onClick={hide}
              title={`Hide ${title.toLowerCase()}`}
            >
              {title}
            </button>
          ) : (
            title
          )}
        </h3>
        <button className={headerLink} onClick={() => setAllOpen(true)}>
          Expand all
        </button>
        <button className={headerLink} onClick={() => setAllOpen(false)}>
          Collapse all
        </button>
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
      className="cursor-pointer select-none py-2 font-semibold text-slate-200 hover:text-white flex items-center gap-2"
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
      <span className="flex-1 min-w-0">{title}</span>
      {children}
    </div>
  );
}
