import { z } from "zod";
import { router } from "@/services/serverFunctions/trpcSetup";
import publicProcedure from "@/services/serverFunctions/publicProcedure";
import { getCoursePathByName } from "../globalSettings/globalSettingsFileStorageService";
import { promises as fs } from "fs";
import { lectureFolderName } from "../lectures/lectureUtils";
import { courseItemFileStorageService } from "../course/courseItemFileStorageService";

const zodItemRef = z.object({
  courseName: z.string(),
  moduleName: z.string(),
  type: z.enum(["Assignment", "Quiz", "Page"]),
  name: z.string(),
});

export const moduleRouter = router({
  getModuleNames: publicProcedure
    .input(z.string())
    .query(async ({ input: courseName }) => {
      return await getModuleNamesFromFiles(courseName);
    }),
  createModule: publicProcedure
    .input(
      z.object({
        courseName: z.string(),
        moduleName: z.string(),
      }),
    )
    .mutation(async ({ input: { courseName, moduleName } }) => {
      await createModuleFile(courseName, moduleName);
    }),
  // files that exist but don't parse, which getAll* leave out
  getInvalidItems: publicProcedure
    .input(z.object({ courseName: z.string(), moduleName: z.string() }))
    .query(async ({ input }) =>
      courseItemFileStorageService.getInvalidItems(input),
    ),
  // every module's unparsable files, for the calendar
  getInvalidItemsForCourse: publicProcedure
    .input(z.string())
    .query(async ({ input: courseName }) => {
      const moduleNames = await getModuleNamesFromFiles(courseName);
      const perModule = await Promise.all(
        moduleNames.map(async (moduleName) =>
          (
            await courseItemFileStorageService.getInvalidItems({
              courseName,
              moduleName,
            })
          ).map((item) => ({ ...item, moduleName })),
        ),
      );
      return perModule.flat();
    }),
  getRawItem: publicProcedure
    .input(zodItemRef)
    .query(async ({ input }) => courseItemFileStorageService.getRawItem(input)),
  saveRawItem: publicProcedure
    .input(zodItemRef.extend({ text: z.string() }))
    .mutation(async ({ input }) =>
      courseItemFileStorageService.saveRawItem(input),
    ),
});

export async function createModuleFile(courseName: string, moduleName: string) {
  const courseDirectory = await getCoursePathByName(courseName);

  await fs.mkdir(courseDirectory + "/" + moduleName, { recursive: true });
}

export async function getModuleNamesFromFiles(courseName: string) {
  const courseDirectory = await getCoursePathByName(courseName);
  const moduleDirectories = await fs.readdir(courseDirectory, {
    withFileTypes: true,
  });

  const modulePromises = moduleDirectories
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const modules = await Promise.all(modulePromises);
  const modulesWithoutLectures = modules.filter(
    (m) => m !== lectureFolderName && !m.startsWith("."),
  );
  return modulesWithoutLectures.sort((a, b) => a.localeCompare(b));
}
