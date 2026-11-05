"use client";
import { ReactNode, useMemo } from "react";
import { useMatches } from "@tanstack/react-router";
import { Pane } from "@/components/panes/Pane";
import { PaneStrip, usePinned } from "@/components/panes/PaneStrip";
import { PanesMenu } from "@/components/panes/PanesMenu";
import { PaneSelect } from "@/components/panes/PaneSelect";
import { FoldedBars, PinButton, topPin } from "@/components/panes/PinnedBars";
import { BreadCrumbs } from "@/components/BreadCrumbs";
import { useCourseContext } from "../context/courseContext";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { CurrentItem, defaultLectureDay, useCurrentItem } from "../currentItem";
import { coursePanes, PaneContext } from "./coursePanes";
import { FollowNavigation } from "./FollowNavigation";
import { ItemEditing } from "./ItemEditing";
import { useItemParts } from "./itemParts";
import { CourseNavigation } from "../CourseNavigation";

/**
 * Mounted once per course, around every page: the top bar (crumbs, then
 * the item's own crumbs and actions, or the course's buttons), a phone's
 * view row, then every pane of the course (see coursePanes) in a row, and
 * the item's bottom bar. Living here and not in the pages, the panes keep
 * their scroll and state from page to page. The frame itself renders the
 * editing of the item open (see ItemEditing): the one the url names, or
 * on the course page the lecture of the day; the routes only match the url
 * and set the title.
 */
export function CourseFrame({ children }: { children: ReactNode }) {
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const urlItem = useCurrentItem();
  const onCoursePage = useMatches().some((m) => m.routeId === "/course/$courseName/");
  const item = useMemo((): CurrentItem | undefined => {
    if (urlItem || !onCoursePage) return urlItem;
    const lectureDay = settings && defaultLectureDay(settings, new Date());
    return lectureDay ? { kind: "lecture", lectureDay } : undefined;
  }, [urlItem, onCoursePage, settings]);
  const [topPinned] = usePinned(topPin);
  // the same object while nothing changed, so memoized pane contents are skipped
  const ctx: PaneContext = useMemo(() => ({ courseName, item, onCoursePage }), [courseName, item, onCoursePage]);
  return (
    <>
      <FollowNavigation />
      <ItemEditing item={item} />
      <div className="h-full flex flex-col px-1 max-w-[2400px] w-full mx-auto bg-gray-900 rounded">
        <FoldedBars />
        <div
          className={
            // one row everywhere: the crumbs and the item's name truncate instead of wrapping
            "py-1 max-md:py-0.5 flex flex-row flex-nowrap items-center gap-x-2 max-md:gap-x-1 " +
            (topPinned ? "" : "max-md:hidden")
          }
        >
          <PinButton pin={topPin} label="the breadcrumbs and view row" className="md:hidden" />
          <span className="hidden md:contents">
            <PanesMenu />
          </span>
          <BreadCrumbs />
          <TopBar onCoursePage={onCoursePage} />
        </div>
        <PaneSelect />
        {/* narrow: one grid cell every pane shares, the selected one visible */}
        <div className="min-h-0 flex-1 md:flex md:flex-row md:gap-0.5 max-md:grid">
          {coursePanes.map(({ Content, ...pane }) => (
            // the server renders what the first screen shows: the course page's calendar
            <Pane key={pane.id} {...pane} ssr={pane.id === "calendar" && onCoursePage}>
              <Content {...ctx} />
            </Pane>
          ))}
        </div>
        <BottomBar onCoursePage={onCoursePage} />
      </div>
      {children}
    </>
  );
}

/** After the crumbs: the course's buttons on the course page, else the item's crumbs and actions. */
function TopBar({ onCoursePage }: { onCoursePage: boolean }) {
  const parts = useItemParts();
  return onCoursePage ? <CourseNavigation /> : parts?.topBar;
}

function BottomBar({ onCoursePage }: { onCoursePage: boolean }) {
  const parts = useItemParts();
  return onCoursePage ? null : parts?.bottomBar;
}

/** The frame with the pane strip around it, for the course route. */
export function CourseFrameWithPanes({ children }: { children: ReactNode }) {
  return (
    <PaneStrip>
      <CourseFrame>{children}</CourseFrame>
    </PaneStrip>
  );
}
