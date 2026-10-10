import { z } from "zod";
import publicProcedure from "@/services/serverFunctions/publicProcedure";
import { router } from "@/services/serverFunctions/trpcSetup";
import { errorLog, logError } from "./errorLogStore";
import { explainError, explainServiceAvailable } from "./errorExplainService";
import { parseItemText } from "@/features/local/course/courseItemFileStorageService";
import { CourseItemType } from "@/features/local/course/courseItemTypes";

const itemTypes: string[] = ["Assignment", "Quiz", "Page"];

export const errorLogRouter = router({
  list: publicProcedure.query(() => ({
    entries: errorLog.list(),
    canExplain: explainServiceAvailable(),
  })),

  report: publicProcedure
    .input(
      z.object({
        source: z.string(),
        message: z.string(),
      }),
    )
    .mutation(({ input }) => {
      logError({ ...input, origin: "browser" });
    }),

  dismiss: publicProcedure
    .input(z.string())
    .mutation(({ input: id }) => errorLog.dismiss(id)),

  clear: publicProcedure.mutation(() => errorLog.clear()),

  explain: publicProcedure
    .input(z.string())
    .mutation(async ({ input: id }) => {
      const entry = errorLog.get(id);
      if (!entry) throw new Error("That error is no longer in the log.");
      if (entry.explanation) return entry.explanation;

      const itemType = entry.context?.itemType;
      const parses =
        itemType && itemTypes.includes(itemType)
          ? async (text: string, name: string) =>
              parseItemText(itemType as CourseItemType, text, name).then(
                () => true,
                () => false,
              )
          : undefined;

      entry.explanation = await explainError(entry, parses);
      return entry.explanation;
    }),
});
