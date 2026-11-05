"use client";
import { usePinned } from "./PaneStrip";
import { PinIcon } from "../icons/ActionIcons";

/** The pin on a bar: pinned, the bar stays at the top; clicked, it is let go. */
export function PinButton({ pin, label, className = "" }: { pin: string; label: string; className?: string }) {
  const [pinned, toggle] = usePinned(pin);
  return (
    <button
      className={"unstyled flex-none !p-0 w-5 flex items-center justify-center " + (pinned ? "text-slate-400 hover:text-slate-200 " : "text-slate-600 hover:text-slate-300 ") + className}
      aria-label={pinned ? `Let ${label} scroll away` : `Keep ${label} at the top`}
      aria-pressed={pinned}
      title={pinned ? `Pinned: ${label} stays at the top. Click to let it scroll away.` : `Click to keep ${label} at the top`}
      onClick={toggle}
    >
      <PinIcon pinned={pinned} />
    </button>
  );
}

/** The pin for a phone's top rows (breadcrumbs and view row), which fold away together. */
export const topPin = "top";

/** A phone's thin strip while the top rows are folded away, with the pin to bring them back. */
export function FoldedBars() {
  const [pinned, toggle] = usePinned(topPin);
  if (pinned) return null;
  return (
    <div className="md:hidden flex-none flex flex-row items-center py-0.5 text-slate-600">
      <button className="unstyled !p-0 w-5 flex items-center justify-center hover:text-slate-300" aria-label="Show the breadcrumbs and view row" title="Pin the breadcrumbs and view row back at the top" onClick={toggle}>
        <PinIcon />
      </button>
    </div>
  );
}
