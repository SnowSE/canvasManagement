import { z } from "zod";
import publicProcedure from "@/services/serverFunctions/publicProcedure";
import { router } from "@/services/serverFunctions/trpcSetup";
import {
  getGlobalSettings,
  updateGlobalSettings,
} from "../globalSettings/globalSettingsFileStorageService";
import { gitService } from "./gitService";

const zodItemRef = z.object({
  courseName: z.string(),
  moduleName: z.string(),
  type: z.enum(["Assignment", "Quiz", "Page"]),
  name: z.string(),
});

export const gitRouter = router({
  status: publicProcedure
    .input(z.string())
    .query(async ({ input: courseName }) => {
      const [status, globalSettings] = await Promise.all([
        gitService.status(courseName),
        getGlobalSettings(),
      ]);
      return {
        status,
        commitOnPublish: globalSettings.git?.commitOnPublish ?? false,
      };
    }),

  commit: publicProcedure
    .input(z.object({ courseName: z.string(), message: z.string().min(1) }))
    .mutation(async ({ input }) =>
      gitService.commit(input.courseName, input.message),
    ),

  setIdentity: publicProcedure
    .input(
      z.object({
        courseName: z.string(),
        name: z.string().min(1),
        email: z.string().min(3),
      }),
    )
    .mutation(async ({ input }) =>
      gitService.setIdentity(input.courseName, input.name, input.email),
    ),

  sync: publicProcedure
    .input(z.string())
    .mutation(async ({ input: courseName }) => gitService.sync(courseName)),

  setCommitOnPublish: publicProcedure
    .input(z.boolean())
    .mutation(async ({ input: commitOnPublish }) => {
      const settings = await getGlobalSettings();
      await updateGlobalSettings({
        ...settings,
        git: { ...settings.git, commitOnPublish },
      });
    }),

  itemHistory: publicProcedure
    .input(zodItemRef)
    .query(async ({ input }) => gitService.itemHistory(input)),

  itemAtCommit: publicProcedure
    .input(zodItemRef.extend({ sha: z.string(), path: z.string() }))
    .query(async ({ input: { sha, path, ...item } }) =>
      gitService.itemAtCommit(item, sha, path),
    ),

  restoreItem: publicProcedure
    .input(zodItemRef.extend({ sha: z.string(), path: z.string() }))
    .mutation(async ({ input: { sha, path, ...item } }) =>
      gitService.restoreItem(item, sha, path),
    ),
});
