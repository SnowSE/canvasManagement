"use client";
import {
  useLecturesSuspenseQuery,
  useLectureUpdateMutation,
} from "@/features/local/lectures/lectureHooks";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { Lecture } from "@/features/local/lectures/lectureModel";
import { getLectureForDay } from "@/features/local/utils/lectureUtils";
import {
  getDateFromStringOrThrow,
  getDateOnlyMarkdownString,
} from "@/features/local/utils/timeUtils";
import { Dispatch, SetStateAction, useCallback, DragEvent } from "react";
import { DraggableItem } from "./draggingContext";
import { movedToDay } from "./shiftDays";
import { useSaveMovedItem } from "./useSaveMovedItem";
import { useCourseContext } from "../courseContext";

export function useItemDropOnDay({
  setIsDragging,
  setModalText,
  setModalCallback,
  setIsLoading,
  modal,
}: {
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  setModalText: Dispatch<SetStateAction<string>>;
  setModalCallback: Dispatch<SetStateAction<() => void>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  modal: { isOpen: boolean; openModal: () => void; closeModal: () => void };
}) {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { courseName } = useCourseContext();
  const { data: weeks } = useLecturesSuspenseQuery();
  const updateLectureMutation = useLectureUpdateMutation();
  const saveMoved = useSaveMovedItem();

  return useCallback(
    (e: DragEvent, day: string) => {
      const rawData = e.dataTransfer.getData("draggableItem");
      if (!rawData) return;
      const itemBeingDragged: DraggableItem = JSON.parse(rawData);

      const { type, sourceModuleName } = itemBeingDragged;
      if (type === "lecture") updateLecture(getDateWithDefaultDueTime());
      else if (!sourceModuleName) console.error("error dropping item on day, sourceModuleName is undefined");
      else if (itemBeingDragged.scheduleDate) moveScheduleBatch(sourceModuleName, itemBeingDragged.scheduleDate);
      else saveMoved(type, movedToDay(itemBeingDragged.item, day), sourceModuleName, sourceModuleName);
      setIsDragging(false);

      function getDateWithDefaultDueTime() {
        const dayAsDate = getDateFromStringOrThrow(day, "in drop callback");
        dayAsDate.setHours(settings.defaultDueTime.hour);
        dayAsDate.setMinutes(settings.defaultDueTime.minute);
        dayAsDate.setSeconds(0);
        return dayAsDate;
      }
      function updateLecture(dayAsDate: Date) {
        const { dueAt: _, ...lecture } = itemBeingDragged.item as Lecture & {
          dueAt: string;
        };
        console.log("dropped lecture on day");
        const existingLecture = getLectureForDay(weeks, dayAsDate);
        if (existingLecture) {
          console.log("attempting to drop on existing lecture");
          setModalText(
            `Are you sure you want to replace ${
              existingLecture?.name || "Un-named Lecture"
            } with ${lecture.name}? This will delete ${
              existingLecture?.name || "Un-named Lecture"
            }.`
          );

          setModalCallback(() => async () => {
            // because sometimes setStates receive a function
            console.log("running callback");
            setIsLoading(true);
            await updateLectureMutation.mutateAsync({
              previousDay: lecture.date,
              lecture: {
                ...lecture,
                date: getDateOnlyMarkdownString(dayAsDate),
              },
              courseName,
              settings,
            });
            setModalText("");
            setModalCallback(() => {});
            modal.closeModal();
            setIsLoading(false);
          });
          modal.openModal();
        } else {
          console.log("updating lecture on unique day");
          updateLectureMutation.mutate({
            previousDay: lecture.date,
            lecture: {
              ...lecture,
              date: getDateOnlyMarkdownString(dayAsDate),
            },
            courseName,
            settings,
          });
        }
      }
      // one batch of an assignment's Schedule: only it moves; the assignment's own dates stay put
      function moveScheduleBatch(moduleName: string, scheduleDate: string) {
        const assignment = itemBeingDragged.item as LocalAssignment;
        const newDay = getDateOnlyMarkdownString(getDateWithDefaultDueTime());
        const schedule = (assignment.schedule ?? []).map((entry) =>
          entry.date === scheduleDate ? { ...entry, date: newDay } : entry
        );
        saveMoved("assignment", { ...assignment, schedule } as LocalAssignment, moduleName, moduleName);
      }
    },
    [
      courseName,
      modal,
      setIsDragging,
      setIsLoading,
      setModalCallback,
      setModalText,
      settings,
      saveMoved,
      updateLectureMutation,
      weeks,
    ]
  );
}
