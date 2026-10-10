"use client";
import { Link } from "@tanstack/react-router";
import { getModuleItemUrl } from "@/services/urlUtils";
import { useCourseContext } from "../../context/courseContext";
import { useDraggingContext } from "../../context/drag/draggingContext";
import { ItemTypeIcon } from "../../ItemTypeIcon";
import { TodayItem } from "./useTodaysItems";
import { WarningIcon } from "@/components/icons/ActionIcons";
import { InvalidItemInDay, unparsableItemUrl } from "./UnparsableItemInDay";

/**
 * A day hidden in course settings: a narrow strip with the date and an icon
 * per item due, each linking to its editor. Items can still be dropped on it.
 */
export function HiddenDayStrip({
  day,
  dayAsDate,
  items,
  unparsableItems,
  className,
}: {
  day: string;
  dayAsDate: Date;
  items: TodayItem[];
  unparsableItems: InvalidItemInDay[];
  className: string;
}) {
  const { courseName } = useCourseContext();
  const { itemDropOnDay } = useDraggingContext();
  const weekday = dayAsDate.toLocaleString("default", { weekday: "long" });

  return (
    <div
      className={
        "hidden md:flex flex-col items-center gap-1 rounded-lg my-1 mx-0.5 min-h-10 bg-gray-950 py-0.5 " +
        className
      }
      title={`${weekday} ${dayAsDate.getDate()} (hidden in course settings)`}
      onDrop={(e) => itemDropOnDay(e, day)}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="text-xs text-slate-500">{dayAsDate.getDate()}</div>
      {items.map(({ type, item, moduleName, scheduleEntry }) => (
        <Link
          key={`${type}-${item.name}-${scheduleEntry?.date ?? "due"}`}
          to={getModuleItemUrl(courseName, moduleName, type, item.name)}
          className="w-4 block hover:scale-125 transition-transform"
          title={`${item.name}, due ${weekday}`}
        >
          <ItemTypeIcon type={type} />
        </Link>
      ))}
      {unparsableItems.map((item) => (
        <Link
          key={`unparsable-${item.type}-${item.moduleName}-${item.name}`}
          to={unparsableItemUrl(courseName, item)}
          className="block text-rose-400 hover:scale-125 transition-transform"
          title={`${item.name} can't be read: ${item.error}`}
        >
          <WarningIcon />
        </Link>
      ))}
    </div>
  );
}
