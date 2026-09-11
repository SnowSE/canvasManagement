"use client";
import { FC, useState } from "react";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { useCalendarItemsContext } from "../../../context/calendarItemsContext";
import TextInput from "@/components/form/TextInput";
import {
  useCreateQuizMutation,
  useUpdateQuizMutation,
} from "@/features/local/quizzes/quizHooks";
import {
  useAddQuizToCanvasMutation,
  useCanvasQuizzesQuery,
  useUpdateQuizInCanvasMutation,
} from "@/features/canvas/hooks/canvasQuizHooks";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { baseCanvasUrl } from "@/features/canvas/services/canvasServiceUtils";
import { getCompareUrl } from "@/services/urlUtils";
import { Link } from "@tanstack/react-router";
import { useCourseContext } from "../../../context/courseContext";
import Modal, { ModalControl } from "@/components/Modal";

function getDuplicateName(name: string, existingNames: string[]): string {
  const match = name.match(/^(.*)\s+(\d+)$/);
  const baseName = match ? match[1] : name;
  const startNum = match ? parseInt(match[2]) + 1 : 2;
  let num = startNum;
  while (existingNames.includes(`${baseName} ${num}`)) {
    num++;
  }
  return `${baseName} ${num}`;
}

export const QuizDayItemContextMenu: FC<{
  modalControl: ModalControl;
  item: IModuleItem;
  moduleName: string;
  /** How many ways the file and Canvas disagree, shown on Compare with Canvas. */
  differenceCount?: number;
}> = ({ modalControl, item, moduleName, differenceCount = 0 }) => {
  const { courseName } = useCourseContext();
  const calendarItems = useCalendarItemsContext();
  const createQuizMutation = useCreateQuizMutation();
  const updateQuizMutation = useUpdateQuizMutation();
  const addToCanvasMutation = useAddQuizToCanvasMutation();
  const updateInCanvasMutation = useUpdateQuizInCanvasMutation();
  const { data: canvasQuizzes } = useCanvasQuizzesQuery();
  const { data: settings } = useLocalCourseSettingsQuery();

  const quizInCanvas = canvasQuizzes?.find((q) => q.title === item.name);
  const canvasUrl = quizInCanvas
    ? `${baseCanvasUrl}/courses/${settings.canvasId}/quizzes/${quizInCanvas.id}`
    : undefined;

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(item.name);

  const handleClose = () => {
    setRenaming(false);
    modalControl.closeModal();
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName === item.name) {
      handleClose();
      return;
    }
    const quiz = item as LocalQuiz;
    await updateQuizMutation.mutateAsync({
      quiz: { ...quiz, name: newName },
      moduleName,
      quizName: newName,
      previousModuleName: moduleName,
      previousQuizName: item.name,
      courseName,
    });
    handleClose();
  };

  const handleDuplicate = () => {
    const quiz = item as LocalQuiz;
    const existingNames = Object.values(calendarItems).flatMap((modules) =>
      (modules[moduleName]?.quizzes ?? []).map((q) => q.name),
    );
    const duplicateName = getDuplicateName(item.name, existingNames);
    createQuizMutation.mutate({
      courseName,
      moduleName,
      quizName: duplicateName,
      quiz: { ...quiz, name: duplicateName },
    });
    handleClose();
  };

  const handleAddToCanvas = () => {
    addToCanvasMutation.mutate({
      quiz: item as LocalQuiz,
      moduleName,
    });
    handleClose();
  };

  const handleUpdateCanvas = () => {
    if (!quizInCanvas) return;
    updateInCanvasMutation.mutate({
      quiz: item as LocalQuiz,
      canvasQuizId: quizInCanvas.id,
    });
    handleClose();
  };

  const baseButtonClasses = " font-bold text-left py-1";
  const normalButtonClass =
    "hover:bg-blue-900   disabled:opacity-50 bg-blue-900/50 text-blue-50 border border-blue-800/70 rounded ";

  return (
    <Modal modalControl={modalControl} backgroundCoverColor="bg-black/30">
      {() => (
        <div className="p-2">
          <div className="text-center p-1 text-slate-200 ">{item.name}</div>
          <div className="flex flex-col gap-2">
            {renaming ? (
              <form onSubmit={handleRename} className="flex flex-col gap-2">
                <TextInput
                  value={newName}
                  setValue={setNewName}
                  label="New Name"
                />
                <button
                  type="button"
                  onClick={() => setRenaming(false)}
                  className={`unstyled ${baseButtonClasses} ${normalButtonClass}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateQuizMutation.isPending || !newName.trim()}
                  className={`unstyled ${baseButtonClasses} ${normalButtonClass}`}
                >
                  Save
                </button>
              </form>
            ) : (
              <>
                {!quizInCanvas && (
                  <button
                    onClick={handleAddToCanvas}
                    disabled={addToCanvasMutation.isPending}
                    className={`unstyled ${baseButtonClasses} ${normalButtonClass}`}
                  >
                    Add to Canvas
                  </button>
                )}
                {quizInCanvas && (
                  <Link
                    to={getCompareUrl(courseName, moduleName, "quiz", item.name)}
                    onClick={handleClose}
                    className={`block px-2 ${baseButtonClasses} ${normalButtonClass}`}
                  >
                    Compare with Canvas
                    {differenceCount > 0 && (
                      <span className="block font-normal text-xs text-rose-300">
                        {differenceCount} difference
                        {differenceCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </Link>
                )}
                {quizInCanvas && (
                  <button
                    onClick={handleUpdateCanvas}
                    disabled={updateInCanvasMutation.isPending}
                    title="Pushes dates, description and quiz settings. Questions in Canvas are left as they are."
                    className={`unstyled ${baseButtonClasses} ${normalButtonClass}`}
                  >
                    Update Canvas
                  </button>
                )}
                {canvasUrl && (
                  <a
                    href={canvasUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleClose}
                    className={`block px-2 ${baseButtonClasses} ${normalButtonClass}`}
                  >
                    Open in Canvas
                  </a>
                )}
                <button
                  onClick={handleDuplicate}
                  disabled={createQuizMutation.isPending}
                  className={`unstyled ${baseButtonClasses} ${normalButtonClass}`}
                >
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    setNewName(item.name);
                    setRenaming(true);
                  }}
                  className={`unstyled ${baseButtonClasses} ${normalButtonClass}`}
                >
                  Rename
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
