"use client";
import { useEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { showPane, usePanes } from "@/components/panes/PaneStrip";
import { currentItemFromPath } from "../currentItem";
import { announcePath, followPaths, tiedTo, usePopOutPane } from "./popOut";

/**
 * What going to another url does to the panes. On a phone, an item opens
 * into its editor and the course into its calendar, whatever was showing
 * before. On a wide window, a link to the course shows its calendar, as the
 * course page always did; the first load keeps the remembered choices. A
 * full instance also tells its pop-outs where it went; a pop-out (see
 * popOut) follows its instance and does nothing to the panes.
 */
export function FollowNavigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const popOut = usePopOutPane();
  const { narrow, jumpTo } = usePanes();
  const onItem = !!currentItemFromPath(pathname);
  // a pop-out follows the instance it's tied to (its ?pane stays, the route keeps it); a full instance announces where it goes
  useEffect(() => {
    if (!popOut) {
      announcePath(pathname);
      return;
    }
    const id = tiedTo();
    // the path is whatever the instance went to, so the router can't type it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (id) return followPaths(id, (path) => router.navigate({ to: path as any }));
  }, [popOut, pathname, router]);
  // the path acted on, on a phone: the first run is during hydration, when
  // the window still counts as wide, so it's acted on once the phone layout is known
  const actedOn = useRef<string>(undefined);
  const previous = useRef<string>(undefined);
  useEffect(() => {
    if (popOut) return;
    if (narrow) {
      if (pathname !== actedOn.current) jumpTo(onItem ? "editor" : "calendar");
      actedOn.current = pathname;
    } else if (previous.current && previous.current !== pathname && !onItem) showPane("calendar");
    previous.current = pathname;
    // the actions are fresh each render; the path and the layout are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, narrow, popOut]);
  return null;
}
