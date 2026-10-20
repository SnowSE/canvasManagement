"use client";
import { usePagesQueries } from "@/features/local/pages/pageHooks";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import {
  getDateFromStringOrThrow,
  getDateOnlyMarkdownString,
} from "@/features/local/utils/timeUtils";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { getWeekNumber } from "../calendar/calendarMonthUtils";
import Modal, { useModal } from "../../../../components/Modal";
import NewItemForm from "./NewItemForm";
import { ModuleCanvasStatus } from "./ModuleCanvasStatus";
import ClientOnly from "@/components/ClientOnly";
import ExpandIcon from "../../../../components/icons/ExpandIcon";
import { useDraggingContext } from "../context/drag/draggingContext";
import { Link } from "@tanstack/react-router";
import { getModuleItemUrl } from "@/services/urlUtils";
import { useCourseContext } from "../context/courseContext";
import { Expandable } from "../../../../components/Expandable";
import { useQuizzesQueries } from "@/features/local/quizzes/quizHooks";
import { useAssignmentsQueries } from "@/features/local/assignments/assignmentHooks";
import { useReorderCanvasModuleItemsMutation } from "@/features/canvas/hooks/canvasModuleHooks";
import {
  useCanvasModulesQuery,
  useCanvasModulesWithItemsQuery,
} from "@/features/canvas/hooks/canvasModuleHooks";
import {
  byOrderingDate,
  canvasOrderDiffers,
} from "@/features/local/modules/moduleItemOrder";
import { Spinner } from "@/components/Spinner";
import { ItemTypeIcon } from "../ItemTypeIcon";
import { useInvalidItemsQuery } from "@/features/local/modules/rawItemHooks";
import { ItemInDay } from "../calendar/day/itemInDay/ItemInDay";
import { useItemSyncStatus } from "../calendar/day/useItemSyncStatus";

export default function ExpandableModule({
  moduleName,
}: {
  moduleName: string;
}) {
  const { itemDropOnModule } = useDraggingContext();
  const { courseName } = useCourseContext();
  const { data: assignments } = useAssignmentsQueries(moduleName);
  const { data: quizzes } = useQuizzesQueries(moduleName);
  const { data: pages } = usePagesQueries(moduleName);
  const modal = useModal();
  const reorderMutation = useReorderCanvasModuleItemsMutation();
  const { data: canvasModules } = useCanvasModulesQuery();
  const { data: canvasModulesWithItems } = useCanvasModulesWithItemsQuery();
  const { data: invalidItems } = useInvalidItemsQuery(moduleName);
  const { statusOf } = useItemSyncStatus();

  const moduleItems: {
    type: "assignment" | "quiz" | "page";
    item: IModuleItem;
  }[] = (assignments ?? [])
    .map(
      (
        a,
      ): {
        type: "assignment" | "quiz" | "page";
        item: IModuleItem;
      } => ({
        type: "assignment",
        item: a,
      }),
    )
    .concat(quizzes.map((q) => ({ type: "quiz", item: q })))
    .concat(pages.map((p) => ({ type: "page", item: p })))
    .sort((a, b) => byOrderingDate(a.item, b.item));

  const canvasModuleItems = canvasModulesWithItems?.find(
    (m) => m.name === moduleName,
  )?.items;
  const canvasOutOfOrder =
    !!canvasModuleItems &&
    canvasOrderDiffers(
      moduleItems.map((i) => i.item),
      [...canvasModuleItems]
        .sort((a, b) => a.position - b.position)
        .map((i) => i.title),
    );

  const { data: settings } = useLocalCourseSettingsQuery();
  const startDate = getDateFromStringOrThrow(
    settings.startDate,
    "expandable module week grouping",
  );

  const groupedItems = moduleItems.reduce(
    (
      groups: {
        dateKey: string;
        weekLabel: string;
        items: { type: "assignment" | "quiz" | "page"; item: IModuleItem }[];
      }[],
      moduleItem,
    ) => {
      const date = getDateFromStringOrThrow(
        moduleItem.item.dueAt,
        "expandable module item grouping",
      );
      const dateKey = getDateOnlyMarkdownString(date);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.dateKey === dateKey) {
        return [
          ...groups.slice(0, -1),
          { ...lastGroup, items: [...lastGroup.items, moduleItem] },
        ];
      }
      const weekNum = getWeekNumber(startDate, date);
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      return [
        ...groups,
        {
          dateKey,
          weekLabel: `Week ${weekNum} - ${dayName}`,
          items: [moduleItem],
        },
      ];
    },
    [],
  );

  return (
    <div
      className="bg-slate-800 rounded-lg border border-slate-600 mb-3 "
      onDrop={(e) => itemDropOnModule(e, moduleName)}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="draggingModule ">
        <div className=" p-3 ">
          <Expandable
            storageKey={`moduleExpanded-${courseName}-${moduleName}`}
            ExpandableElement={({ setIsExpanded, isExpanded }) => (
              <div
                className="font-bold flex flex-row justify-between cursor-pointer "
                role="button"
                onClick={() => setIsExpanded((e) => !e)}
              >
                <div className="flex-1">{moduleName}</div>
                <div className=" flex flex-row justify-end">
                  {invalidItems && invalidItems.length > 0 && (
                    <span
                      className="me-2 rounded-full bg-rose-900 px-2 text-sm text-rose-100"
                      title={`${invalidItems.length} file${invalidItems.length === 1 ? "" : "s"} in this module can't be read`}
                    >
                      ⚠ {invalidItems.length}
                    </span>
                  )}
                  <ClientOnly>
                    <ModuleCanvasStatus moduleName={moduleName} />
                  </ClientOnly>
                  <ExpandIcon
                    style={{
                      ...(isExpanded
                        ? { rotate: "90deg" }
                        : { rotate: "180deg" }),
                    }}
                  />
                </div>
              </div>
            )}
          >
            <>
              {!reorderMutation.isPending && (
                <button
                  className={" me-3 " + (canvasOutOfOrder ? " text-amber-300! " : "")}
                  title={
                    canvasOutOfOrder
                      ? "Canvas lists this module's items in a different order"
                      : undefined
                  }
                  onClick={() => {
                    const canvasModuleId = canvasModules?.find(
                      (m) => m.name === moduleName,
                    )?.id;
                    if (!canvasModuleId) {
                      console.error(
                        "Canvas module ID not found for",
                        moduleName,
                      );
                      return;
                    }
                    reorderMutation.mutate({
                      moduleId: canvasModuleId,
                      items: moduleItems.map((item) => item.item),
                    });
                  }}
                >
                  {canvasOutOfOrder ? "Sort in Canvas (order differs)" : "Sort by Date"}
                </button>
              )}
              {reorderMutation.isPending && <Spinner />}
              <Modal
                modalControl={modal}
                buttonText="New Item"
                modalWidth="w-135"
              >
                {({ closeModal }) => (
                  <div>
                    <NewItemForm
                      moduleName={moduleName}
                      onCreate={closeModal}
                    />
                    <br />
                    <button onClick={closeModal}>close</button>
                  </div>
                )}
              </Modal>
              <div className="flex flex-col">
                {invalidItems && invalidItems.length > 0 && (
                  <div>
                    <div className="text-rose-400 text-sm mt-1 ps-1">
                      Can&rsquo;t be read, click to fix
                    </div>
                    {invalidItems.map((invalid) => (
                      <div
                        key={invalid.type + invalid.name}
                        className="flex items-start ps-3"
                        title={invalid.error}
                      >
                        <div className="w-6 p-1 flex-none">
                          <ItemTypeIcon type={invalid.type.toLowerCase()} />
                        </div>
                        <Link
                          to={getModuleItemUrl(
                            courseName,
                            moduleName,
                            invalid.type === "Assignment"
                              ? "assignment"
                              : invalid.type === "Quiz"
                                ? "quiz"
                                : "page",
                            invalid.name,
                          )}
                          className="ps-1 text-rose-300 underline decoration-wavy decoration-rose-600 hover:text-rose-100"
                        >
                          {invalid.name}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
                {groupedItems.map(({ weekLabel, items }) => (
                  <div key={weekLabel}>
                    <div className="text-slate-500 text-sm mt-1 ps-1">
                      {weekLabel}
                    </div>
                    {items.map(({ type, item }) => (
                      <ItemInDay
                        key={item.name + type}
                        type={type}
                        item={item}
                        moduleName={moduleName}
                        {...statusOf(type, item, moduleName)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </>
          </Expandable>
        </div>
      </div>
    </div>
  );
}
