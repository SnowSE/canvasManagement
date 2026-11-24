import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { LocalAssignment } from "../assignments/models/localAssignment";
import { z } from "zod";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";

export const courseItemTypes = ["Assignment", "Quiz", "Page"] as const;
export type CourseItemType = (typeof courseItemTypes)[number];
export const zodCourseItemType = z.enum(courseItemTypes);

/** Each type's name in the app's urls and in the page's own lists. */
export const kindOf = {
  Assignment: "assignment",
  Quiz: "quiz",
  Page: "page",
} as const;
export type ItemKind = (typeof kindOf)[CourseItemType];
export type CourseItemReturnType<T extends CourseItemType> =
  T extends "Assignment"
    ? LocalAssignment
    : T extends "Quiz"
    ? LocalQuiz
    : LocalCoursePage;

export const typeToFolder = {
  Assignment: "assignments",
  Quiz: "quizzes",
  Page: "pages",
} as const;
