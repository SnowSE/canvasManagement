"use client";
import { MouseEvent, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { showPane } from "./PaneStrip";

/** A link that also shows a pane of where it goes (an item with its Compare with Canvas pane, say). */
export function ShowPaneLink({
  pane,
  to,
  onClick,
  className,
  title,
  children,
}: {
  /** None: a plain link. */
  pane?: string;
  to: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      className={className}
      title={title}
      onClick={(e) => {
        if (pane) showPane(pane);
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
