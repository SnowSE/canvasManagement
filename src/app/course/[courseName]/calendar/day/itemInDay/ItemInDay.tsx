"use client";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { getModuleItemUrl } from "@/services/urlUtils";
import { Link } from "@tanstack/react-router";
import { FC, ReactNode } from "react";
import { useCourseContext } from "../../../context/courseContext";
import { useTooltip } from "@/components/useTooltip";
import { DraggableItem } from "../../../context/drag/draggingContext";
import ClientOnly from "@/components/ClientOnly";
import { useDragStyleContext } from "../../../context/drag/dragStyleContext";
import { Tooltip } from "../../../../../../components/Tooltip";
import { AssignmentDayItemContextMenu } from "./AssignmentDayItemContextMenu";
import { QuizDayItemContextMenu } from "./QuizDayItemContextMenu";
import { PageDayItemContextMenu } from "./PageDayItemContextMenu";
import { GetPreviewContent } from "./GetPreviewContent";
import { useModal } from "@/components/Modal";
import { ItemTypeIcon } from "../../../ItemTypeIcon";
import { AssignmentScheduleEntry } from "@/features/local/assignments/models/localAssignment";
import { formatHumanReadableDate } from "@/services/utils/dateFormat";
import { useRosterStudentsQuery } from "@/features/canvas/roster/rosterHooks";
import { studentDisplayName } from "@/features/local/assignments/models/utils/scheduleUtils";

export const ItemInDay: FC<{
  type: "assignment" | "page" | "quiz";
  status: "localOnly" | "incomplete" | "published";
  moduleName: string;
  item: IModuleItem;
  message: ReactNode;
  scheduleEntry?: AssignmentScheduleEntry;
}> = ({ type, moduleName, status, item, message, scheduleEntry }) => {
  const { courseName } = useCourseContext();
  const { setIsDragging } = useDragStyleContext();
  const { visible, targetRef, showTooltip, hideTooltip } = useTooltip(500);
  const modalControl = useModal();
  const { data: roster } = useRosterStudentsQuery();

  const handleContextMenu = (e: React.MouseEvent) => {
    if (type !== "assignment" && type !== "quiz" && type !== "page") return;
    e.preventDefault();
    e.stopPropagation();
    modalControl.openModal({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className={" relative group "}>
      <Link
        to={getModuleItemUrl(courseName, moduleName, type, item.name)}
        className={
          " border rounded-sm px-1 sm:mx-1 break-words mb-1 truncate sm:text-wrap text-nowrap " +
          " bg-slate-800 " +
          " block " +
          (scheduleEntry ? " border-dashed " : "") +
          (status === "localOnly" && " text-slate-500 border-slate-600 ") +
          (status === "incomplete" && " border-rose-900 ") +
          (status === "published" && " border-green-800 ")
        }
        role="button"
        draggable="true"
        onDragStart={(e) => {
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
        <div className="flex justify-between">
          <div className="flex-1">{item.name}</div>
          {scheduleEntry && (
            <div
              className="text-xs text-slate-400 self-center px-1"
              title="students scheduled for this day"
            >
              {scheduleEntry.students.length}
            </div>
          )}
          <div className="w-7 p-1">
            <ItemTypeIcon type={type} />
          </div>
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
                  <ul className="list-disc ps-5">
                    {scheduleEntry.students.map((s) => (
                      <li key={s}>{studentDisplayName(s, roster?.students)}</li>
                    ))}
                  </ul>
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
          />
        ) : status === "published" ? (
          <Tooltip
            message={
              <div className="max-w-md">
                <GetPreviewContent type={type} item={item} />
              </div>
            }
            targetRef={targetRef}
            visible={visible}
          />
        ) : (
          <Tooltip message={message} targetRef={targetRef} visible={visible} />
        )}
        {type === "assignment" && (
          <AssignmentDayItemContextMenu
            modalControl={modalControl}
            item={item}
            moduleName={moduleName}
          />
        )}
        {type === "quiz" && (
          <QuizDayItemContextMenu
            modalControl={modalControl}
            item={item}
            moduleName={moduleName}
          />
        )}
        {type === "page" && (
          <PageDayItemContextMenu
            modalControl={modalControl}
            item={item}
            moduleName={moduleName}
          />
        )}
      </ClientOnly>
    </div>
  );
};
