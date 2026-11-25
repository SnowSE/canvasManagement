"use client";
import MarkdownDisplay from "@/components/MarkdownDisplay";
import { QuizDayItemContextMenu } from "../../../calendar/day/itemInDay/QuizDayItemContextMenu";
import { CompareQuizWithCanvas } from "../compare/CompareWithCanvas";
import EditQuiz from "./[quizName]/EditQuiz";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import type { ItemKindViews } from "../../../itemKind";

/** How a quiz is shown (see itemKindViews). */
export const quizViews: ItemKindViews = {
  Editor: ({ moduleName, name }) => <EditQuiz moduleName={moduleName} quizName={name} />,
  Menu: QuizDayItemContextMenu,
  Preview: ({ item }) => (item as LocalQuiz).questions.map((q, i) => (
      <div key={i} className="">
        <MarkdownDisplay markdown={q.text} />
      </div>
    )),
  Compare: ({ moduleName, name }) => <CompareQuizWithCanvas moduleName={moduleName} quizName={name} />,
};
