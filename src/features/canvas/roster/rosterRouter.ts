import { z } from "zod";
import publicProcedure from "@/services/serverFunctions/publicProcedure";
import { router } from "@/services/serverFunctions/trpcSetup";
import { fileStorageService } from "@/features/local/utils/fileStorageService";
import { rosterCache } from "./rosterCache";

async function getCanvasId(courseName: string) {
  const settingsList = await fileStorageService.settings.getAllCoursesSettings();
  const settings = settingsList.find((s) => s.name === courseName);
  if (!settings) throw new Error(`Could not find settings for course ${courseName}`);
  return settings.canvasId;
}

const courseNameInput = z.string().describe("course name");

export const rosterRouter = router({
  students: publicProcedure
    .input(courseNameInput)
    .query(async ({ input: courseName }) =>
      rosterCache.getStudents(await getCanvasId(courseName))
    ),
  syncStudents: publicProcedure
    .input(courseNameInput)
    .mutation(async ({ input: courseName }) =>
      rosterCache.refreshStudents(await getCanvasId(courseName))
    ),
  groupSets: publicProcedure
    .input(courseNameInput)
    .query(async ({ input: courseName }) =>
      rosterCache.getGroupSets(await getCanvasId(courseName))
    ),
  syncGroupSets: publicProcedure
    .input(courseNameInput)
    .mutation(async ({ input: courseName }) =>
      rosterCache.refreshGroupSets(await getCanvasId(courseName))
    ),
});
