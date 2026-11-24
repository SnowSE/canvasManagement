import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { useQuizQuery, useUpdateQuizMutation } from "@/features/local/quizzes/quizHooks";
import { useRenameQuizMutation } from "@/features/canvas/hooks/canvasRenameHooks";
import { RenameItem } from "../../../RenameItem";

export function UpdateQuizName({ moduleName, quizName }: { quizName: string; moduleName: string }) {
  const { courseName } = useCourseContext();
  const { data: quiz } = useQuizQuery(moduleName, quizName);
  const updateQuiz = useUpdateQuizMutation();
  const renameQuiz = useRenameQuizMutation();
  return (
    <RenameItem
      noun="Quiz"
      type="quiz"
      moduleName={moduleName}
      name={quizName}
      rename={(name) =>
        renameQuiz.mutateAsync({
          oldName: quizName,
          newName: name,
          renameFile: () => updateQuiz.mutateAsync({ quiz, moduleName, quizName: name, previousModuleName: moduleName, previousQuizName: quizName, courseName }),
        })
      }
    />
  );
}
