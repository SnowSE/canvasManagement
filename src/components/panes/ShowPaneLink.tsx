"use client";
import { MouseEvent, ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { showPane } from "./PaneStrip";
import { openPopOut, popOutUrl } from "@/app/course/[courseName]/panes/popOut";
import { viewClick } from "./viewClick";

/**
 * A link that also shows a pane of where it goes (an item with its Compare
 * with Canvas pane, say), clicked as a view icon is (see viewClick): a plain
 * click or Ctrl shows the pane in this window and goes to the item there;
 * Shift opens just that view in a window of its own. Its address is the
 * pane's pop-out url, so the middle button and the browser's "open in new
 * tab" show just that view in a tab.
 */
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
  const router = useRouter();
  if (!pane)
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Link to={to as any} className={className} title={title} onClick={onClick}>
        {children}
      </Link>
    );
  return (
    <a
      href={popOutUrl(to, pane)}
      className={className}
      title={title}
      onClick={(e) => {
        onClick?.(e);
        const click = viewClick(e);
        if (e.defaultPrevented || click === "browser") return;
        e.preventDefault();
        if (click === "window") return openPopOut(to, pane, true);
        showPane(pane, click !== "default");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.navigate({ to: to as any });
      }}
    >
      {children}
    </a>
  );
}
