// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getQueryClient } from "./providersQueryClientUtils";
import { canvasAssignmentKeys } from "@/features/canvas/hooks/canvasAssignmentHooks";
import { canvasCourseModuleKeys } from "@/features/canvas/hooks/canvasModuleHooks";
import { canvasKeys } from "@/features/canvas/hooks/canvasHooks";
import { canvasCourseKeys } from "@/features/canvas/hooks/canvasCourseHooks";

const hour = 60 * 60 * 1000;

describe("how long Canvas data stays fresh", () => {
  const client = getQueryClient();
  const staleTime = (key: readonly unknown[]) => client.getQueryDefaults(key).staleTime;

  it("every Canvas query is fresh for an hour", () => {
    for (const key of [
      canvasAssignmentKeys.assignments(7),
      canvasCourseModuleKeys.modules(7),
      [...canvasCourseModuleKeys.modules(7), "items"],
      canvasKeys.allTerms,
      canvasCourseKeys.courseListInTerm(3),
      canvasCourseKeys.students(7),
    ])
      expect(staleTime(key), key.join("/")).toBe(hour);
  });

  it("the app's own data keeps the short default", () => {
    expect(staleTime(["errorLog", "list"])).toBeUndefined();
  });
});
