import publicProcedure from "@/services/serverFunctions/publicProcedure";
import { router } from "@/services/serverFunctions/trpcSetup";
import { z } from "zod";
import { ensureImagesUploaded } from "./files/canvasImageSync";

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
});
