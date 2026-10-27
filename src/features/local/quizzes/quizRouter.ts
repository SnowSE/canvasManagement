import publicProcedure from "../../../services/serverFunctions/publicProcedure";
import { z } from "zod";
import { router } from "../../../services/serverFunctions/trpcSetup";
import {
  LocalQuiz,
  zodLocalQuiz,
} from "@/features/local/quizzes/models/localQuiz";
import {
  getCoursePathByName,
  getGlobalSettings,
} from "../globalSettings/globalSettingsFileStorageService";
import path from "path";
import { promises as fs } from "fs";
import { quizMarkdownUtils } from "./models/utils/quizMarkdownUtils";
import { courseItemFileStorageService } from "../course/courseItemFileStorageService";
import { getFeedbackDelimitersFromSettings } from "../globalSettings/globalSettingsUtils";
import { assertValidFileName } from "@/services/fileNameValidation";
import { listBankFiles, readBank } from "./questionBankFileStorage";

export const quizRouter = router({
  getQuiz: publicProcedure
    .input(
      z.object({
        courseName: z.string(),
        moduleName: z.string(),
        quizName: z.string(),
      }),
    )
    .query(async ({ input: { courseName, moduleName, quizName } }) => {
      return await courseItemFileStorageService.getItem({
        courseName,
        moduleName,
        name: quizName,
        type: "Quiz",
      });
    }),

  getAllQuizzes: publicProcedure
    .input(
      z.object({
        courseName: z.string(),
        moduleName: z.string(),
      }),
    )
    .query(async ({ input: { courseName, moduleName } }) => {
      return await courseItemFileStorageService.getItems({
        courseName,
        moduleName,
        type: "Quiz",
      });
    }),
  createQuiz: publicProcedure
    .input(
      z.object({
        courseName: z.string(),
        moduleName: z.string(),
        quizName: z.string(),
        quiz: zodLocalQuiz,
      }),
    )
    .mutation(async ({ input: { courseName, moduleName, quizName, quiz } }) => {
      await updateQuizFile({
        courseName,
        moduleName,
        quizName,
        quiz,
      });
    }),
  updateQuiz: publicProcedure
    .input(
      z.object({
        courseName: z.string(),
        moduleName: z.string(),
        previousModuleName: z
          .string()
          .describe("Previous module name before the update"),
        previousQuizName: z
          .string()
          .describe("Previous quiz name before the update"),
        quizName: z.string(),
        quiz: zodLocalQuiz,
      }),
    )
    .mutation(
      async ({
        input: {
          courseName,
          moduleName,
          quizName,
          quiz,
          previousModuleName,
          previousQuizName,
        },
      }) => {
        await updateQuizFile({
          courseName,
          moduleName,
          quizName,
          quiz,
        });

        if (
          quizName !== previousQuizName ||
          moduleName !== previousModuleName
        ) {
          await deleteQuizFile({
            courseName,
            moduleName: previousModuleName,
            quizName: previousQuizName,
          });
        }
      },
    ),
  /** The question banks a quiz's text names, for the editor to parse it with. */
  getBanks: publicProcedure
    .input(
      z.object({
        courseName: z.string(),
        moduleName: z.string(),
        paths: z.array(z.string()),
      }),
    )
    .query(async ({ input: { courseName, moduleName, paths } }) => {
      const quizFolder = path.join(
        await getCoursePathByName(courseName),
        moduleName,
        "quizzes",
      );
      // any quiz in the folder resolves a relative path the same way
      const quizFile = path.join(quizFolder, "quiz.md");
      const entries = await Promise.all(
        paths.map(async (p) => [p, await readBank(quizFile, p)] as const),
      );
      return Object.fromEntries(entries);
    }),

  /** Every bank file in a module's banks folder, as `<module>/banks/<file>`. */
  listBankFiles: publicProcedure
    .input(z.string())
    .query(async ({ input: courseName }) => await listBankFiles(courseName)),

  deleteQuiz: publicProcedure
    .input(
      z.object({
        courseName: z.string(),
        moduleName: z.string(),
        quizName: z.string(),
      }),
    )
    .mutation(async ({ input: { courseName, moduleName, quizName } }) => {
      await deleteQuizFile({
        courseName,
        moduleName,
        quizName,
      });
    }),
});

export async function deleteQuizFile({
  courseName,
  moduleName,
  quizName,
}: {
  courseName: string;
  moduleName: string;
  quizName: string;
}) {
  const courseDirectory = await getCoursePathByName(courseName);
  const filePath = path.join(
    courseDirectory,
    moduleName,
    "quizzes",
    quizName + ".md",
  );
  console.log("removing quiz", filePath);
  await fs.unlink(filePath);
}

export async function updateQuizFile({
  courseName,
  moduleName,
  quizName,
  quiz,
}: {
  courseName: string;
  moduleName: string;
  quizName: string;
  quiz: LocalQuiz;
}) {
  assertValidFileName(quizName);
  const courseDirectory = await getCoursePathByName(courseName);
  const folder = path.join(courseDirectory, moduleName, "quizzes");
  await fs.mkdir(folder, { recursive: true });
  const filePath = path.join(
    courseDirectory,
    moduleName,
    "quizzes",
    quizName + ".md",
  );

  const globalSettings = await getGlobalSettings();
  const delimiters = getFeedbackDelimitersFromSettings(globalSettings);
  const quizMarkdown = quizMarkdownUtils.assertCanRoundTrip(quiz, delimiters);
  console.log(`Saving quiz ${filePath}`);
  await fs.writeFile(filePath, quizMarkdown);
}
