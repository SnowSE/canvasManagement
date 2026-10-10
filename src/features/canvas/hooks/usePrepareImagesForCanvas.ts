import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import {
  extractImageSources,
  markdownToHtmlNoImages,
} from "@/services/htmlMarkdownUtils";
import { isLocalImageSource } from "@/services/imageSources";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";

const fileSyncEnabled = process.env.NEXT_PUBLIC_ENABLE_FILE_SYNC === "true";

export const localImageSourcesInMarkdown = (markdown: string[]) => [
  ...new Set(
    markdown
      .flatMap((md) => extractImageSources(markdownToHtmlNoImages(md)))
      .filter(isLocalImageSource),
  ),
];

/** Every piece of a quiz that is rendered as markdown for Canvas. */
export const quizMarkdownParts = (quiz: LocalQuiz) => [
  quiz.description,
  ...quiz.questions.flatMap((q) => [q.text, ...q.answers.map((a) => a.text)]),
];

/**
 * Call right before publishing: uploads the item's local images to Canvas
 * (new or changed ones only) and returns the settings to render with, which
 * map each image to its Canvas url. Throws if an image file is missing.
 */
export const usePrepareImagesForCanvas = () => {
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const ensureUploaded = useMutation(
    trpc.canvasFile.ensureImagesUploaded.mutationOptions(),
  );

  return async (markdown: string[]): Promise<LocalCourseSettings> => {
    if (!fileSyncEnabled) return settings;
    const sources = localImageSourcesInMarkdown(markdown);
    if (sources.length === 0) return settings;

    const updated = await ensureUploaded.mutateAsync({ courseName, sources });
    queryClient.setQueryData(
      trpc.settings.courseSettings.queryKey(courseName),
      updated,
    );
    queryClient.invalidateQueries({
      queryKey: trpc.settings.allCoursesSettings.queryKey(),
    });
    return updated;
  };
};
