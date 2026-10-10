"use client";
import { Link } from "@tanstack/react-router";
import { getModuleItemUrl } from "@/services/urlUtils";
import { useCourseContext } from "../../context/courseContext";
import { useTooltip } from "@/components/useTooltip";
import { Tooltip } from "@/components/Tooltip";
import ClientOnly from "@/components/ClientOnly";
import { WarningIcon } from "@/components/icons/ActionIcons";
import type { InvalidCourseItem } from "@/features/local/course/courseItemFileStorageService";
import { getDateFromStringOrThrow, getDateOnlyMarkdownString } from "@/features/local/utils/timeUtils";
import { useInvalidItemsForCourseQuery } from "@/features/local/modules/rawItemHooks";

export type InvalidItemInDay = InvalidCourseItem & { moduleName: string };

const urlType = { Assignment: "assignment", Quiz: "quiz", Page: "page" } as const;

/** Unparsable files whose date line still reads, due on this day. */
export function useUnparsableItemsOnDay(day: string): InvalidItemInDay[] {
  const { data } = useInvalidItemsForCourseQuery();
  const dateKey = getDateOnlyMarkdownString(
    getDateFromStringOrThrow(day, "unparsable items day"),
  );
  return (data ?? []).filter(
    (item) =>
      item.dueAt &&
      getDateOnlyMarkdownString(
        getDateFromStringOrThrow(item.dueAt, "unparsable item due date"),
      ) === dateKey,
  );
}

export const unparsableItemUrl = (courseName: string, item: InvalidItemInDay) =>
  getModuleItemUrl(courseName, item.moduleName, urlType[item.type], item.name);

/**
 * A file that doesn't parse, on the day its DueAt line names. Hover shows the
 * parse error; click opens the file as text to fix.
 */
export function UnparsableItemInDay({ item }: { item: InvalidItemInDay }) {
  const { courseName } = useCourseContext();
  const { visible, targetRef, showTooltip, hideTooltip, tooltipProps } =
    useTooltip(300);

  return (
    <div className="relative">
      <Link
        to={unparsableItemUrl(courseName, item)}
        className="block border border-dashed border-rose-700 rounded-sm px-1 sm:mx-1 mb-1 bg-rose-950/40 text-rose-200 truncate sm:text-wrap text-nowrap"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        ref={targetRef}
      >
        <div className="flow-root">
          <div className="float-right py-0.5 ps-1 text-rose-400" title="This file can't be read">
            <WarningIcon />
          </div>
          {item.name}
        </div>
      </Link>
      <ClientOnly>
        <Tooltip
          message={
            <div className="max-w-md text-start">
              <div className="font-bold text-rose-300">
                {item.type} {item.name} can&rsquo;t be read
              </div>
              <div className="font-mono text-sm whitespace-pre-wrap py-1">
                {item.error}
              </div>
              <div className="text-slate-400">Click to open the file and fix it.</div>
            </div>
          }
          targetRef={targetRef}
          visible={visible}
          {...tooltipProps}
        />
      </ClientOnly>
    </div>
  );
}
