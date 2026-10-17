import publicProcedure from "@/services/serverFunctions/publicProcedure";
import { router } from "@/services/serverFunctions/trpcSetup";
import { z } from "zod";
import { ensureImagesUploaded } from "./files/canvasImageSync";
import { diagnoseImage } from "./files/publicImageFiles";

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
  // why a local image in a preview did not load
  diagnoseImage: publicProcedure
    .input(z.object({ src: z.string() }))
    .query(({ input: { src } }) => diagnoseImage(src)),
});
