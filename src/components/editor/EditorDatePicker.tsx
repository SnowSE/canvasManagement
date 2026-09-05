"use client";
import { FC, useEffect, useState } from "react";
import {
  DayOfWeek,
  getDayOfWeek,
} from "@/features/local/course/localCourseSettings";
import {
  getDateFromString,
  getDateOnlyMarkdownString,
} from "@/features/local/utils/timeUtils";
import { EditorAssistData } from "./assist/editorAssistData";

export type DatePickerMode = "datetime" | "date";

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function sameDay(a: Date, b: Date) {
  return getDateOnlyMarkdownString(a) === getDateOnlyMarkdownString(b);
}

/**
 * Popup shown under a date line in the editor. Every click writes the value
 * back immediately; there is no OK button.
 */
export const EditorDatePicker: FC<{
  mode: DatePickerMode;
  value: Date | null;
  calendar: EditorAssistData["calendar"];
  onChange: (date: Date | null) => void;
  onClose: () => void;
  style: React.CSSProperties;
}> = ({ mode, value, calendar, onChange, onClose, style }) => {
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    firstOfMonth(value ?? startingPoint(calendar))
  );
  useEffect(() => {
    if (value) setViewMonth(firstOfMonth(value));
  }, [value]);

  const today = new Date();
  const semesterStart = getDateFromString(calendar.startDate);
  const semesterEnd = getDateFromString(calendar.endDate);
  const holidays = new Set(calendar.holidays);

  const isClassDay = (d: Date) =>
    calendar.daysOfWeek.includes(getDayOfWeek(d)) &&
    (!semesterStart || d >= semesterStart) &&
    (!semesterEnd || d <= semesterEnd) &&
    !holidays.has(getDateOnlyMarkdownString(d));

  const withTimeOf = (day: Date, base: Date | null) =>
    new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      base ? base.getHours() : calendar.defaultDueTime.hour,
      base ? base.getMinutes() : calendar.defaultDueTime.minute,
      0
    );

  const pickDay = (day: Date) => onChange(withTimeOf(day, value));
  const shiftDays = (n: number) => {
    const base = value ?? withTimeOf(today, null);
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    onChange(d);
  };
  const nextClassDay = () => {
    const base = value ?? withTimeOf(today, null);
    const d = new Date(base);
    for (let i = 0; i < 366; i++) {
      d.setDate(d.getDate() + 1);
      if (isClassDay(d)) {
        onChange(d);
        return;
      }
    }
  };
  const setTime = (hour: number, minute: number) => {
    const base = value ?? today;
    onChange(
      new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0)
    );
  };

  // 6 rows x 7 days starting on the Sunday on/before the 1st
  const gridStart = new Date(viewMonth);
  gridStart.setDate(1 - gridStart.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const hour12 = value ? (value.getHours() % 12 === 0 ? 12 : value.getHours() % 12) : 12;
  const ampm = value ? (value.getHours() < 12 ? "AM" : "PM") : "PM";
  const minute = value ? value.getMinutes() : calendar.defaultDueTime.minute;
  const to24 = (h12: number, part: string) =>
    part === "PM" ? (h12 % 12) + 12 : h12 % 12;

  const quick =
    "unstyled rounded-full border border-slate-600 px-2 text-xs text-slate-300 hover:bg-slate-700";

  return (
    <div
      className="absolute z-30 w-[19rem] rounded-md border border-slate-600 bg-slate-800 p-3 text-sm text-slate-200 shadow-xl shadow-black/50"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={mode === "date" ? "pick a date" : "pick a date and time"}
    >
      <div className="flex items-center justify-between font-semibold">
        <button
          className="unstyled px-2 text-slate-400 hover:text-slate-100"
          onClick={() =>
            setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
          }
          aria-label="previous month"
        >
          ‹
        </button>
        <span>
          {viewMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          className="unstyled px-2 text-slate-400 hover:text-slate-100"
          onClick={() =>
            setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
          }
          aria-label="next month"
        >
          ›
        </button>
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5 text-center tabular-nums">
        {weekdayLabels.map((w) => (
          <div key={w} className="text-xs text-slate-500">
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const inMonth = d.getMonth() === viewMonth.getMonth();
          const selected = value && sameDay(d, value);
          const holiday = holidays.has(getDateOnlyMarkdownString(d));
          const classDay = isClassDay(d);
          return (
            <button
              key={d.toISOString()}
              className={
                "unstyled rounded py-0.5 hover:bg-slate-600 " +
                (selected
                  ? " bg-blue-800 font-semibold text-white "
                  : classDay
                    ? " bg-slate-700 text-slate-100 "
                    : holiday
                      ? " text-rose-400/70 line-through "
                      : inMonth
                        ? " text-slate-400 "
                        : " text-slate-600 ") +
                (sameDay(d, today) && !selected ? " outline outline-1 outline-slate-500 " : "")
              }
              onClick={() => pickDay(d)}
              title={
                holiday
                  ? "holiday"
                  : classDay
                    ? "class day"
                    : undefined
              }
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-3 text-xs text-slate-500">
        <span>
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-700 align-[-1px]" /> class
          day
        </span>
        <span>
          <i className="inline-block h-2.5 w-2.5 rounded-sm border border-rose-400/70 align-[-1px]" />{" "}
          holiday
        </span>
      </div>

      {mode === "datetime" && (
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-slate-700 pt-2">
          <select
            className="w-16! flex-none rounded border border-slate-600 bg-slate-900 px-1 py-0.5"
            value={hour12}
            onChange={(e) => setTime(to24(parseInt(e.target.value), ampm), minute)}
            aria-label="hour"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          :
          <select
            className="w-16! flex-none rounded border border-slate-600 bg-slate-900 px-1 py-0.5"
            value={minute}
            onChange={(e) => setTime(to24(hour12, ampm), parseInt(e.target.value))}
            aria-label="minute"
          >
            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
          <select
            className="w-[4.5rem]! flex-none rounded border border-slate-600 bg-slate-900 px-1 py-0.5"
            value={ampm}
            onChange={(e) => setTime(to24(hour12, e.target.value), minute)}
            aria-label="AM or PM"
          >
            <option>AM</option>
            <option>PM</option>
          </select>
          <div className="flex-1" />
          <button
            className={quick + " whitespace-nowrap"}
            onClick={() =>
              setTime(calendar.defaultDueTime.hour, calendar.defaultDueTime.minute)
            }
            title={`course default due time, ${formatTime(
              calendar.defaultDueTime.hour,
              calendar.defaultDueTime.minute
            )}`}
          >
            default time
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        <button className={quick} onClick={() => shiftDays(-7)}>
          −1 week
        </button>
        <button className={quick} onClick={() => shiftDays(7)}>
          +1 week
        </button>
        <button className={quick} onClick={nextClassDay}>
          next class day
        </button>
        {mode === "datetime" && (
          <button className={quick} onClick={() => onChange(null)}>
            clear
          </button>
        )}
        <div className="flex-1" />
        <button className={quick} onClick={onClose} title="Esc">
          close
        </button>
      </div>
    </div>
  );
};

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startingPoint(calendar: EditorAssistData["calendar"]) {
  const today = new Date();
  const start = getDateFromString(calendar.startDate);
  const end = getDateFromString(calendar.endDate);
  if (start && end && (today < start || today > end)) return start;
  return today;
}

function formatTime(hour: number, minute: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export { DayOfWeek };
