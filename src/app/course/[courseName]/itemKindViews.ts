import type { ItemKind } from "@/features/local/course/courseItemTypes";
import type { ItemKindViews } from "./itemKind";
import { assignmentViews } from "./modules/[moduleName]/assignment/assignmentViews";
import { quizViews } from "./modules/[moduleName]/quiz/quizViews";
import { pageViews } from "./modules/[moduleName]/page/pageViews";

/** How each kind of item is shown, by its name (see itemKinds for what it is). */
export const itemKindViews: Record<ItemKind, ItemKindViews> = {
  assignment: assignmentViews,
  quiz: quizViews,
  page: pageViews,
};
