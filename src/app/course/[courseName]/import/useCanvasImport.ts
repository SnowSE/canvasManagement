"use client";
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { useCourseContext } from "../context/courseContext";
import {
  useLocalCourseSettingsQuery,
  useUpdateLocalCourseSettingsMutation,
} from "@/features/local/course/localCoursesHooks";
import {
  useCreateModuleMutation,
  useModuleNamesQuery,
} from "@/features/local/modules/localCourseModuleHooks";
import { useInvalidItemsForCourseQuery } from "@/features/local/modules/rawItemHooks";
import { useCreateAssignmentMutation } from "@/features/local/assignments/assignmentHooks";
import { useCreateQuizMutation } from "@/features/local/quizzes/quizHooks";
import { useCreatePageMutation } from "@/features/local/pages/pageHooks";
import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import { CanvasQuiz } from "@/features/canvas/models/quizzes/canvasQuizModel";
import { CanvasPage } from "@/features/canvas/models/pages/canvasPageModel";
import { CanvasAssignmentGroup } from "@/features/canvas/models/assignments/canvasAssignmentGroup";
import { canvasQuizService } from "@/features/canvas/services/canvasQuizService";
import { canvasNewQuizService } from "@/features/canvas/services/canvasNewQuizService";
import { newQuizToLocal } from "@/features/canvas/import/newQuizImport";
import {
  useRosterGroupSetsQuery,
  useSyncRosterGroupSetsMutation,
} from "@/features/canvas/roster/rosterHooks";
import { GroupSetsSnapshot } from "@/features/canvas/roster/rosterModels";
import { isAxiosError } from "axios";
import { validateFileName } from "@/services/fileNameValidation";
import {
  canvasAssignmentToLocal,
  canvasPageToLocal,
  canvasQuizToLocal,
  ImportCandidate,
  ImportContext,
  ImportItemType,
} from "@/features/canvas/import/canvasImport";

/**
 * Names of every file in the course, parsed or not, by type; undefined until
 * every module has loaded. Not suspending: importing creates modules, and the
 * table should stay up while their (empty) lists load.
 */
export function useLocalItemNames():
  | Record<ImportItemType, Set<string>>
  | undefined {
  const { courseName } = useCourseContext();
  const { data: moduleNames } = useModuleNamesQuery();
  const trpc = useTRPC();
  const input = (moduleName: string) => ({ courseName, moduleName });
  const assignments = useQueries({
    queries: moduleNames.map((m) =>
      trpc.assignment.getAllAssignments.queryOptions(input(m)),
    ),
  });
  const quizzes = useQueries({
    queries: moduleNames.map((m) => trpc.quiz.getAllQuizzes.queryOptions(input(m))),
  });
  const pages = useQueries({
    queries: moduleNames.map((m) => trpc.page.getAllPages.queryOptions(input(m))),
  });
  const { data: invalidItems } = useInvalidItemsForCourseQuery();
  const all = [...assignments, ...quizzes, ...pages];
  if (!invalidItems || all.some((r) => !r.data)) return undefined;

  const names = <T extends { name: string }>(results: { data?: T[] }[]) =>
    results.flatMap((r) => (r.data ?? []).map((item) => item.name));
  const unparsed = (type: string) =>
    invalidItems.filter((i) => i.type === type).map((i) => i.name);
  return {
    assignment: new Set([...names(assignments), ...unparsed("Assignment")]),
    quiz: new Set([...names(quizzes), ...unparsed("Quiz")]),
    page: new Set([...names(pages), ...unparsed("Page")]),
  };
}

export type ImportOutcome =
  | { status: "imported"; moduleName: string; warnings: string[] }
  | { status: "failed"; error: string };

export interface ImportResult {
  candidate: ImportCandidate;
  outcome: ImportOutcome;
}

/**
 * The module an item goes in: the Canvas module holding it, when that name
 * can be a folder, otherwise the module picked for items not in one.
 */
export function targetModuleFor(
  candidate: ImportCandidate,
  otherModule: string,
): { moduleName: string; warning?: string } {
  const [canvasModule, ...more] = candidate.canvasModules;
  if (!canvasModule) return { moduleName: otherModule };
  if (validateFileName(canvasModule))
    return {
      moduleName: otherModule,
      warning: `the Canvas module "${canvasModule}" can't be a folder name, so it went in ${otherModule}`,
    };
  return {
    moduleName: canvasModule,
    ...(more.length > 0 && {
      warning: `it is also in ${more.join(", ")} in Canvas; the file can only be in ${canvasModule}`,
    }),
  };
}

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

/**
 * Imports Canvas items one at a time: first adds the assignment groups and
 * modules they need, then writes a file for each, recording how each went.
 */
export function useCanvasImport({
  canvasAssignments,
  canvasQuizzes,
  canvasPages,
  canvasAssignmentGroups,
  fallbackDateFor,
}: {
  canvasAssignments: CanvasAssignment[];
  canvasQuizzes: CanvasQuiz[];
  canvasPages: CanvasPage[];
  canvasAssignmentGroups: CanvasAssignmentGroup[];
  fallbackDateFor: (candidate: ImportCandidate) => string;
}) {
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: moduleNames } = useModuleNamesQuery();
  const updateSettings = useUpdateLocalCourseSettingsMutation();
  const createModule = useCreateModuleMutation();
  const createAssignment = useCreateAssignmentMutation();
  const createQuiz = useCreateQuizMutation();
  const createPage = useCreatePageMutation();
  const { data: groupSets } = useRosterGroupSetsQuery();
  const syncGroupSets = useSyncRosterGroupSetsMutation();

  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<{ index: number; total: number; name: string }>();
  const [results, setResults] = useState<ImportResult[]>([]);

  const addMissingAssignmentGroups = async (candidates: ImportCandidate[]) => {
    const needed = new Set(
      candidates
        .filter((c) => c.type !== "page" && c.canvasAssignmentGroupId)
        .map((c) => c.canvasAssignmentGroupId!),
    );
    const missing = canvasAssignmentGroups.filter(
      (g) =>
        needed.has(g.id) &&
        !settings.assignmentGroups.some(
          (local) => local.canvasId === g.id || local.name === g.name,
        ),
    );
    if (missing.length === 0) return;
    await updateSettings.mutateAsync({
      ...settings,
      assignmentGroups: [
        ...settings.assignmentGroups,
        ...missing.map((g) => ({
          id: crypto.randomUUID(),
          name: g.name,
          weight: g.group_weight,
          canvasId: g.id,
        })),
      ],
    });
  };

  // a group assignment's GroupSet is the group set's name, which comes from
  // the roster cache; load it when it doesn't have every set needed
  const loadGroupSetNames = async (candidates: ImportCandidate[]) => {
    const namesOf = (snapshot?: GroupSetsSnapshot) =>
      new Map((snapshot?.groupSets ?? []).map((g) => [g.id, g.name]));
    const loaded = namesOf(groupSets);
    const needed = candidates
      .filter((c) => c.type === "assignment")
      .map((c) => canvasAssignments.find((a) => a.id === c.canvasId)?.group_category_id)
      .filter((id): id is number => !!id);
    if (needed.every((id) => loaded.has(id))) return loaded;
    try {
      return namesOf(await syncGroupSets.mutateAsync(courseName));
    } catch {
      return loaded; // each group assignment says its GroupSet is missing
    }
  };

  const assignmentGroupName = (canvasGroupId: number | undefined) =>
    canvasGroupId === undefined
      ? undefined
      : (settings.assignmentGroups.find((g) => g.canvasId === canvasGroupId)
          ?.name ?? canvasAssignmentGroups.find((g) => g.id === canvasGroupId)?.name);

  const questionsForbidden = (e: unknown) => {
    if (isAxiosError(e) && e.response?.status === 403)
      throw new Error(
        "Canvas won't share this quiz's questions. That happens in a concluded course, or when your account can't edit the quiz. No file was written.",
      );
    throw e;
  };

  const convertClassicQuiz = async (candidate: ImportCandidate, context: ImportContext) => {
    const canvasQuiz = canvasQuizzes.find((q) => q.id === candidate.canvasId)!;
    const questions = await canvasQuizService
      .getQuizQuestions(settings.canvasId, canvasQuiz.id)
      .catch(questionsForbidden);
    return canvasQuizToLocal(canvasQuiz, questions, context);
  };

  // a New Quiz is a Canvas assignment; its settings and questions come from
  // the New Quizzes API under the same id
  const convertNewQuiz = async (candidate: ImportCandidate, context: ImportContext) => {
    const canvasAssignment = canvasAssignments.find((a) => a.id === candidate.canvasId)!;
    const [newQuiz, items] = await Promise.all([
      canvasNewQuizService.get(settings.canvasId, candidate.canvasId),
      canvasNewQuizService.getItems(settings.canvasId, candidate.canvasId),
    ]).catch(questionsForbidden);
    return newQuizToLocal(canvasAssignment, newQuiz, items, context);
  };

  const importOne = async (
    candidate: ImportCandidate,
    moduleName: string,
    groupSetNames: Map<number, string>,
  ): Promise<string[]> => {
    const context: ImportContext = {
      assignmentGroupName: assignmentGroupName(candidate.canvasAssignmentGroupId),
      fallbackDate: fallbackDateFor(candidate),
      groupSetNames,
    };
    if (candidate.type === "assignment") {
      const canvasAssignment = canvasAssignments.find((a) => a.id === candidate.canvasId)!;
      const { item, warnings } = canvasAssignmentToLocal(canvasAssignment, context);
      await createAssignment.mutateAsync({
        courseName,
        moduleName,
        assignmentName: item.name,
        assignment: item,
      });
      return warnings;
    }
    if (candidate.type === "quiz") {
      const { item, warnings } = candidate.newQuiz
        ? await convertNewQuiz(candidate, context)
        : await convertClassicQuiz(candidate, context);
      await createQuiz.mutateAsync({
        courseName,
        moduleName,
        quizName: item.name,
        quiz: item,
      });
      return warnings;
    }
    const canvasPage = canvasPages.find((p) => p.page_id === candidate.canvasId)!;
    const { item, warnings } = canvasPageToLocal(canvasPage, context);
    await createPage.mutateAsync({
      courseName,
      moduleName,
      pageName: item.name,
      page: item,
    });
    return warnings;
  };

  const importItems = async (candidates: ImportCandidate[], otherModule: string) => {
    setRunning(true);
    setResults([]);
    try {
      try {
        await addMissingAssignmentGroups(candidates);
      } catch (e) {
        // the items still import; their AssignmentGroupName just isn't in the settings yet
        console.error("adding assignment groups", e);
      }

      const groupSetNames = await loadGroupSetNames(candidates);
      const existingModules = new Set(moduleNames);
      const written = new Set<string>();
      for (const [index, candidate] of candidates.entries()) {
        setCurrent({ index: index + 1, total: candidates.length, name: candidate.name });
        const { moduleName, warning } = targetModuleFor(candidate, otherModule);
        let outcome: ImportOutcome;
        try {
          // the file is named after the item, so a second one would replace it
          const file = `${candidate.type}:${candidate.name}`;
          if (written.has(file))
            throw new Error(
              `Canvas has more than one ${candidate.type} with this name, and the first one was imported. Rename one in Canvas to import both.`,
            );
          if (!existingModules.has(moduleName)) {
            await createModule.mutateAsync({ courseName, moduleName });
            existingModules.add(moduleName);
          }
          const warnings = await importOne(candidate, moduleName, groupSetNames);
          written.add(file);
          outcome = {
            status: "imported",
            moduleName,
            warnings: warning ? [warning, ...warnings] : warnings,
          };
        } catch (e) {
          outcome = { status: "failed", error: errorMessage(e) };
        }
        setResults((previous) => [...previous, { candidate, outcome }]);
      }
    } finally {
      setCurrent(undefined);
      setRunning(false);
    }
  };

  return { importItems, running, current, results, clearResults: () => setResults([]) };
}
