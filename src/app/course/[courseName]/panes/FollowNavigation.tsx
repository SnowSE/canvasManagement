"use client";
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { showPane, usePanes } from "@/components/panes/PaneStrip";
import { currentItemFromPath } from "../currentItem";

/**
 * What going to another url does to the panes. On a phone, an item opens
 * into its editor and the course into its calendar, whatever was showing
 * before. On a wide window, a link to the course shows its calendar, as the
 * course page always did; the first load keeps the remembered choices.
 */
export function FollowNavigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { narrow, jumpTo } = usePanes();
  const onItem = !!currentItemFromPath(pathname);
  // the path acted on, on a phone: the first run is during hydration, when
  // the window still counts as wide, so it's acted on once the phone layout is known
  const actedOn = useRef<string>(undefined);
  const previous = useRef<string>(undefined);
  useEffect(() => {
    if (narrow) {
      if (pathname !== actedOn.current) jumpTo(onItem ? "editor" : "calendar");
      actedOn.current = pathname;
    } else if (previous.current && previous.current !== pathname && !onItem) showPane("calendar");
    previous.current = pathname;
    // the actions are fresh each render; the path and the layout are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, narrow]);
  return null;
}
