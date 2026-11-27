"use client";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { ItemKind } from "@/features/local/course/courseItemTypes";
import { getModuleItemUrl } from "@/services/urlUtils";
import { Link } from "@tanstack/react-router";
import { FC, ReactNode } from "react";
import { useCourseContext } from "../../../context/courseContext";
import { useTooltip } from "@/components/useTooltip";
import { DraggableItem } from "../../../context/drag/draggingContext";
import ClientOnly from "@/components/ClientOnly";
import { useDragStyleContext } from "../../../context/drag/dragStyleContext";
import { Tooltip } from "../../../../../../components/Tooltip";
import { useModal } from "@/components/Modal";
import { ItemTypeIcon } from "../../../itemKinds";
import { itemKindViews } from "../../../itemKindViews";
import { AssignmentScheduleEntry } from "@/features/local/assignments/models/localAssignment";
import { formatHumanReadableDate } from "@/services/utils/dateFormat";
import { useRosterStudentsQuery } from "@/features/canvas/roster/rosterHooks";
import { studentDisplayName } from "@/features/local/assignments/models/utils/scheduleUtils";
import { SyncField } from "../getAssignmentSyncStatus";
import { SyncDifferencesTooltip } from "./SyncDifferencesTooltip";

export const ItemInDay: FC<{
  type: ItemKind;
  status: "localOnly" | "incomplete" | "published";
  moduleName: string;
  item: IModuleItem;
  message: ReactNode;
  differences?: SyncField[];
  unpublished?: boolean;
  problem?: string;
  /** What couldn't be compared yet: not called in sync (a dashed border), not counted as differing. */
  unchecked?: string;
  scheduleEntry?: AssignmentScheduleEntry;
}> = ({
  type,
  moduleName,
  status,
  item,
  message,
  differences = [],
  unpublished,
  problem,
  unchecked,
  scheduleEntry,
}) => {
  const { courseName } = useCourseContext();
  const { setIsDragging } = useDragStyleContext();
  const { visible, targetRef, showTooltip, hideTooltip, tooltipProps } =
    useTooltip(500);
  const modalControl = useModal();
  const { Menu, Preview } = itemKindViews[type];

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    modalControl.openModal({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className={" relative group "}>
      <Link
        to={getModuleItemUrl(courseName, moduleName, type, item.name)}
        className={
          " border rounded-sm px-1 @week:mx-1 mb-1 truncate @week:text-wrap text-nowrap " +
          " bg-slate-800 " +
          " block " +
          (scheduleEntry || (unchecked && status === "published") ? " border-dashed " : "") +
          (status === "localOnly" ? " text-slate-500 " : "") +
          (status === "incomplete" || problem
            ? " border-rose-900 "
            : status === "localOnly" || unchecked
              ? " border-slate-600 "
              : " border-green-800 ")
        }
        role="button"
        draggable="true"
        onDragStart={(e) => {
          // the browser sends no mouseleave while dragging, so an open (or
          // about to open) tooltip would sit over the days being dropped on
          hideTooltip();
          const draggableItem: DraggableItem = {
            type,
            item,
            sourceModuleName: moduleName,
            scheduleDate: scheduleEntry?.date,
          };
          e.dataTransfer.setData(
            "draggableItem",
            JSON.stringify(draggableItem),
          );
          setIsDragging(true);
        }}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onContextMenu={handleContextMenu}
        ref={targetRef}
      >
        {/* floated so a long title wraps under the icon instead of beside it */}
        <div className="flow-root">
          <div className="float-left w-6 py-0.5 pe-1">
            <ItemTypeIcon type={type} />
          </div>
          {scheduleEntry && (
            <div
              className="float-right text-xs text-slate-400 leading-6 px-1"
              title="students scheduled for this day"
            >
              {scheduleEntry.students.length}
            </div>
          )}
          {item.name}
        </div>
      </Link>
      <ClientOnly>
        {scheduleEntry ? (
          <Tooltip
            message={
              <div className="max-w-md text-start">
                <div className="font-bold">
                  {item.name} · scheduled {scheduleEntry.date}
                </div>
                {scheduleEntry.students.length === 0 ? (
                  <div className="text-slate-400">no students yet</div>
                ) : (
                  <ScheduledStudents students={scheduleEntry.students} />
                )}
                {status !== "published" && (
                  <div className="text-rose-300 pt-1">{message}</div>
                )}
                <div className="text-slate-400 pt-1">
                  everyone else: {formatHumanReadableDate(item.dueAt)}
                </div>
              </div>
            }
            targetRef={targetRef}
            visible={visible}
            {...tooltipProps}
          />
        ) : status === "published" && !unchecked ? (
          Preview && (
            <Tooltip
              message={
                <div className="max-w-md">
                  <Preview item={item} />
                </div>
              }
              targetRef={targetRef}
              visible={visible}
              {...tooltipProps}
            />
          )
        ) : (
          <Tooltip
            message={
              <SyncDifferencesTooltip
                type={type}
                moduleName={moduleName}
                itemName={item.name}
                status={status}
                message={message}
                differences={differences}
                unpublished={unpublished}
                problem={problem}
              />
            }
            targetRef={targetRef}
            visible={visible}
            {...tooltipProps}
          />
        )}
        {/* a menu is built when it opens: with one on every item, their query
            hooks were most of what a calendar re-render cost */}
        {modalControl.isOpen && <Menu modalControl={modalControl} item={item} moduleName={moduleName} differenceCount={differences.length} />}
      </ClientOnly>
    </div>
  );
};

// its own component so only scheduled pills subscribe to the roster
function ScheduledStudents({ students }: { students: string[] }) {
  const { data: roster } = useRosterStudentsQuery();
  return (
    <ul className="list-disc ps-5">
      {students.map((s) => (
        <li key={s}>{studentDisplayName(s, roster?.students)}</li>
      ))}
    </ul>
  );
}
