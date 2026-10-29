import { CanvasAssignmentGroup } from "@/features/canvas/models/assignments/canvasAssignmentGroup";
import { CanvasCourseModel } from "@/features/canvas/models/courses/canvasCourseModel";
import { LocalAssignmentGroup } from "@/features/local/assignments/models/localAssignmentGroup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { useUpdateLocalCourseSettingsMutation } from "@/features/local/course/localCoursesHooks";
import { canvasAssignmentGroupService } from "../services/canvasAssignmentGroupService";
import { canvasService } from "../services/canvasService";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { syncAssignmentGroups } from "@/app/course/[courseName]/settings/syncAssignmentGroups";

export const canvasCourseKeys = {
  courseDetails: (canavasId: number) =>
    ["canvas", canavasId, "course details"] as const,
  assignmentGroups: (canavasId: number) =>
    ["canvas", canavasId, "assignment groups"] as const,
  assignmentGroupCounts: (canavasId: number) =>
    ["canvas", canavasId, "assignment group counts"] as const,
  courseListInTerm: (canvasTermId: number | undefined) =>
    ["canvas courses in term", canvasTermId] as const,
  students: (canvasId: number) =>
    ["students in canvas course", canvasId] as const,
};

export const useCourseListInTermQuery = (canvasTermId: number | undefined) =>
  useQuery({
    queryKey: canvasCourseKeys.courseListInTerm(canvasTermId),
    queryFn: async (): Promise<CanvasCourseModel[]> =>
      canvasTermId ? await canvasService.getCourses(canvasTermId) : [],
    enabled: !!canvasTermId,
  });

/**
 * Sync with Canvas: adds Canvas's groups to the settings, creates the
 * settings' groups in Canvas and pushes the settings' weights. Never deletes.
 */
export const useSyncAssignmentGroupsMutation = () => {
  const queryClient = useQueryClient();
  const updateSettings = useUpdateLocalCourseSettingsMutation();
  return useMutation({
    mutationFn: async (settings: LocalCourseSettings) => {
      const canvasGroups = await canvasAssignmentGroupService.getAll(settings.canvasId);
      const plan = syncAssignmentGroups(settings.assignmentGroups, canvasGroups, () =>
        crypto.randomUUID(),
      );
      const created = new Map<string, number | undefined>();
      for (const group of plan.create)
        created.set(
          group.id,
          (await canvasAssignmentGroupService.create(settings.canvasId, group)).canvasId,
        );
      for (const group of plan.updateWeight)
        await canvasAssignmentGroupService.update(settings.canvasId, group);
      await updateSettings.mutateAsync({
        ...settings,
        assignmentGroups: plan.groups.map((g) =>
          created.has(g.id) ? { ...g, canvasId: created.get(g.id) } : g,
        ),
      });
      return {
        added: plan.added.length,
        created: plan.create.length,
        weights: plan.updateWeight.length,
      };
    },
    onSettled: (_, __, settings) =>
      queryClient.invalidateQueries({
        queryKey: canvasCourseKeys.assignmentGroups(settings.canvasId),
      }),
  });
};

/**
 * Deletes or renames a group without deleting anything in it: its items move
 * to group `to`, in the files and in Canvas. A `to` no group has yet renames
 * the group, keeping its weight. Without a `to`, an empty group is removed.
 */
export const useMoveAssignmentGroupMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const move = useMutation(trpc.settings.moveAssignmentGroup.mutationOptions());
  const saveSettings = useMutation(trpc.settings.updateSettings.mutationOptions());
  return useMutation({
    mutationFn: async ({
      settings,
      from,
      to,
    }: {
      settings: LocalCourseSettings;
      from: LocalAssignmentGroup;
      to?: string;
    }) => {
      const groups = settings.assignmentGroups;
      if (to === undefined) {
        // Canvas first: it refuses a group that still has assignments
        if (from.canvasId) await canvasAssignmentGroupService.delete(settings.canvasId, from.canvasId);
        await saveSettings.mutateAsync({ ...settings, assignmentGroups: groups.filter((g) => g.id !== from.id) });
        return 0;
      }
      let target = groups.find((g) => g.name === to && g.id !== from.id);
      // a target Canvas lacks is created first; that only adds
      if (target && from.canvasId && !target.canvasId)
        target = await canvasAssignmentGroupService.create(settings.canvasId, target);
      const assignmentGroups = target
        ? groups.filter((g) => g.id !== from.id).map((g) => (g.id === target.id ? target : g))
        : groups.map((g) => (g.id === from.id ? { ...g, name: to } : g));
      // the files and settings before Canvas: if Canvas then fails, the next
      // sync adds the old group back instead of the settings naming a group
      // Canvas no longer has
      const moved = await move.mutateAsync({ from: from.name, to, settings: { ...settings, assignmentGroups } });
      if (from.canvasId && target)
        await canvasAssignmentGroupService.delete(settings.canvasId, from.canvasId, target.canvasId!);
      else if (from.canvasId)
        await canvasAssignmentGroupService.update(settings.canvasId, { ...from, name: to });
      return moved;
    },
    onSettled: (_, __, { settings }) => {
      queryClient.invalidateQueries({ queryKey: trpc.settings.courseSettings.queryKey(settings.name) });
      queryClient.invalidateQueries({ queryKey: trpc.settings.allCoursesSettings.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.settings.assignmentGroupItemCounts.queryKey(settings.name) });
      queryClient.invalidateQueries({ queryKey: canvasCourseKeys.assignmentGroups(settings.canvasId) });
      queryClient.invalidateQueries({ queryKey: canvasCourseKeys.assignmentGroupCounts(settings.canvasId) });
    },
  });
};

/** How many assignments each Canvas group holds, by its id. */
export const useCanvasAssignmentGroupCountsQuery = (canvasId: number) =>
  useQuery({
    queryKey: canvasCourseKeys.assignmentGroupCounts(canvasId),
    queryFn: () => canvasAssignmentGroupService.assignmentCounts(canvasId),
  });

export const useAssignmentGroupsQuery = (canvasId: number) => {
  return useQuery({
    queryKey: canvasCourseKeys.assignmentGroups(canvasId),
    queryFn: async (): Promise<CanvasAssignmentGroup[]> =>
      await canvasAssignmentGroupService.getAll(canvasId),
  });
};

export const useCourseStudentsQuery = (canvasId: number) =>
  useQuery({
    queryKey: canvasCourseKeys.students(canvasId),
    queryFn: async () => await canvasService.getEnrolledStudents(canvasId),
  });

/** Whether Canvas weights the final grade by assignment group, and a way to change it. */
export const useWeightByGroups = (canvasId: number) => {
  const queryClient = useQueryClient();
  const course = useQuery({
    queryKey: canvasCourseKeys.courseDetails(canvasId),
    queryFn: () => canvasService.getCourse(canvasId),
  });
  const set = useMutation({
    mutationFn: (weighted: boolean) => canvasService.setWeightByGroups(canvasId, weighted),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: canvasCourseKeys.courseDetails(canvasId) }),
  });
  return { weighted: course.data?.apply_assignment_group_weights, set };
};
