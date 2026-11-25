import publicProcedure from "@/services/serverFunctions/publicProcedure";
import { router } from "@/services/serverFunctions/trpcSetup";
import { z } from "zod";
import { ensureImagesUploaded } from "./files/canvasImageSync";
import { renameCourseFile, uploadCourseFile } from "./files/canvasCourseFileSync";
import { diagnoseImage } from "./files/publicImageFiles";

const found = z.object({ id: z.number(), locked: z.boolean() });

export const canvasFileRouter = router({
  ensureImagesUploaded: publicProcedure
    .input(
      z.object({
        courseName: z.string(),
        sources: z.string().array().describe("image src values from the rendered html"),
      }),
    )
    .mutation(async ({ input: { courseName, sources } }) =>
      ensureImagesUploaded(courseName, sources),
    ),
  // sends one of the course's files to its Canvas files (see uploadCourseFile)
  uploadCourseFile: publicProcedure
    .input(z.object({ courseName: z.string(), path: z.string().describe("The file's place in the course: <module>/files/<name>"), inCanvas: found.optional(), movedFrom: found.optional() }))
    .mutation(({ input }) => uploadCourseFile(input)),
  renameCourseFile: publicProcedure
    .input(z.object({ courseName: z.string(), moduleName: z.string(), name: z.string(), newName: z.string(), canvasFileId: z.number().optional() }))
    .mutation(({ input }) => renameCourseFile(input)),
  // why a local image in a preview did not load
  diagnoseImage: publicProcedure
    .input(z.object({ src: z.string() }))
    .query(({ input: { src } }) => diagnoseImage(src)),
});
