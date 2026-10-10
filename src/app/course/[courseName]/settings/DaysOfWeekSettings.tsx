"use client";
import { Spinner } from "@/components/Spinner";
import {
  useLocalCourseSettingsQuery,
  useUpdateLocalCourseSettingsMutation,
} from "@/features/local/course/localCoursesHooks";
import {
  DayOfWeek,
  LocalCourseSettings,
} from "@/features/local/course/localCourseSettings";
import React from "react";

type DayState = "class" | "noClass" | "hidden";

const dayState = (settings: LocalCourseSettings, day: DayOfWeek): DayState =>
  settings.daysOfWeek.includes(day)
    ? "class"
    : (settings.hiddenDays ?? []).includes(day)
      ? "hidden"
      : "noClass";

const nextState: Record<DayState, DayState> = {
  class: "noClass",
  noClass: "hidden",
  hidden: "class",
};

const withDayState = (
  settings: LocalCourseSettings,
  day: DayOfWeek,
  state: DayState,
): LocalCourseSettings => {
  const daysOfWeek = settings.daysOfWeek.filter((d) => d !== day);
  const hiddenDays = (settings.hiddenDays ?? []).filter((d) => d !== day);
  if (state === "class") daysOfWeek.push(day);
  if (state === "hidden") hiddenDays.push(day);
  const ordered = (days: DayOfWeek[]) =>
    Object.values(DayOfWeek).filter((d) => days.includes(d));
  return {
    ...settings,
    daysOfWeek: ordered(daysOfWeek),
    hiddenDays: ordered(hiddenDays),
  };
};

const stateStyles: Record<DayState, string> = {
  class: "",
  noClass: "unstyled btn-outline",
  hidden: "unstyled btn-outline !border-dashed !border-slate-700 text-slate-500 line-through",
};

const stateLabels: Record<DayState, string> = {
  class: "class day",
  noClass: "no class",
  hidden: "no class, hidden from the calendar",
};

export default function DaysOfWeekSettings() {
  const { data: settings } = useLocalCourseSettingsQuery();
  const updateSettings = useUpdateLocalCourseSettingsMutation();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row flex-wrap gap-2 sm:gap-3">
        {Object.values(DayOfWeek).map((day) => {
          const state = dayState(settings, day);
          return (
            <button
              key={day}
              className={stateStyles[state]}
              title={`${day}: ${stateLabels[state]}. Click for ${stateLabels[nextState[state]]}.`}
              onClick={() =>
                updateSettings.mutate(withDayState(settings, day, nextState[state]))
              }
            >
              <span className="sm:hidden">{day.slice(0, 3)}</span>
              <span className="hidden sm:inline">{day}</span>
            </button>
          );
        })}
        {updateSettings.isPending && <Spinner />}
      </div>
      <div className="text-sm text-slate-400">
        Click a day to cycle it: <span className="text-blue-200 font-semibold">class day</span>{" "}
        → <span className="font-semibold">no class</span> →{" "}
        <span className="line-through">hidden</span>, a day without class that the
        calendar narrows to a strip to make room for the others.
      </div>
    </div>
  );
}
