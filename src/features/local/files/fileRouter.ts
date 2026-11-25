import { z } from "zod";
import publicProcedure from "@/services/serverFunctions/publicProcedure";
import { router } from "@/services/serverFunctions/trpcSetup";
import { courseFileStorage, previewBase } from "./courseFileStorage";

const inModule = z.object({ courseName: z.string(), moduleName: z.string() });
const item = inModule.extend({ name: z.string() });
const place = z.object({ moduleName: z.string(), name: z.string() });

export const fileRouter = router({
  get: publicProcedure.input(item).query(({ input }) => courseFileStorage.get(input)),
  getAll: publicProcedure.input(inModule).query(({ input }) => courseFileStorage.inModule(input)),
  create: publicProcedure.input(item).mutation(({ input }) => courseFileStorage.create(input)),
  save: publicProcedure.input(item.extend({ text: z.string() })).mutation(({ input }) => courseFileStorage.save(input)),
  place: publicProcedure.input(z.object({ courseName: z.string(), from: place, to: place })).mutation(({ input }) => courseFileStorage.place(input)),
  remove: publicProcedure.input(item).mutation(({ input }) => courseFileStorage.remove(input)),

  // only the app's own pages can ask (see requestGuard): the key in it is what lets a preview's files load
  previewBase: publicProcedure.query(() => previewBase),
  paths: publicProcedure.input(z.string()).query(({ input: courseName }) => courseFileStorage.paths(courseName)),
  used: publicProcedure
    .input(z.object({ courseName: z.string(), path: z.string().describe("The file's place in the course: <module>/files/<name>") }))
    .query(({ input }) => courseFileStorage.used(input.courseName, input.path)),
});
