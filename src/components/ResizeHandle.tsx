"use client";
import { RefObject, useEffect } from "react";
import { remember } from "./storage";

/**
 * A drag handle that sizes a pane. The size is remembered in localStorage and
 * applied as CSS variables on `target` by `apply`; it's written imperatively
 * because React keeps server-rendered attributes during hydration, so a style
 * prop set from localStorage would never reach the DOM.
 */
export function ResizeHandle({
  axis,
  target,
  storageKey,
  size,
  apply,
  label,
  className = "",
}: {
  /** "col" drags sideways, "row" up and down. */
  axis: "col" | "row";
  target: RefObject<HTMLElement | null>;
  storageKey: string;
  /** The new size for a pointer position, already clamped. */
  size: (e: React.PointerEvent, targetRect: DOMRect) => number;
  apply: (target: HTMLElement, size: number) => void;
  label: string;
  className?: string;
}) {
  useEffect(() => {
    const stored = parseFloat(localStorage.getItem(storageKey) ?? "");
    if (target.current && !Number.isNaN(stored)) apply(target.current, stored);
    // apply is a fresh function each render; the stored size is read once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, target]);

  const col = axis === "col";
  return (
    <div
      className={
        "flex-none touch-none flex items-center justify-center rounded hover:bg-slate-700/50 " +
        (col ? "w-4 mx-0.5 cursor-col-resize " : "h-4 my-0.5 cursor-row-resize ") +
        className
      }
      onPointerDown={(e) => {
        // no text selection or native drag of what the pointer crosses
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId) || !target.current) return;
        const value = size(e, target.current.getBoundingClientRect());
        apply(target.current, value);
        remember(storageKey, String(value));
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      aria-label={label}
      role="separator"
    >
      <div className={"rounded bg-slate-600 " + (col ? "h-16 w-1.5" : "w-16 h-1.5")} />
    </div>
  );
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
