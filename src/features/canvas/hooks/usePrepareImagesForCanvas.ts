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
import { isCourseFileLink, linkedFiles } from "@/services/courseFileLinks";
import { unsendableLinks, withCanvasFiles } from "@/features/canvas/services/files/fileSyncStatus";
import { canvasFilesQuery } from "./canvasCourseFileHooks";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";

const fileSyncEnabled = process.env.NEXT_PUBLIC_ENABLE_FILE_SYNC === "true";

export const localImageSourcesInMarkdown = (markdown: string[]) => [
  ...new Set(
    markdown
      .flatMap((md) => extractImageSources(markdownToHtmlNoImages(md)))
      // an SVG kept in the course is one of its files (see courseFileLinks), sent to Canvas on its own
      .filter((src) => isLocalImageSource(src) && !isCourseFileLink(src)),
  ),
];

/** Every piece of a quiz that is rendered as markdown for Canvas. */
export const quizMarkdownParts = (quiz: LocalQuiz) => [
  quiz.description,
  ...quiz.questions.flatMap((q) => [q.text, ...q.answers.map((a) => a.text)]),
];

/** The course's files the markdown links to or shows, by name (see courseFileLinks). */
const linkedFilesInMarkdown = (markdown: string[]) => linkedFiles(markdown.map((md) => markdownToHtmlNoImages(md)).join(""));

/**
 * Call right before publishing: uploads the item's local images to Canvas
 * (new or changed ones only) and returns the settings to render with, which
 * map each image to its Canvas url. Throws if an image file is missing, or
 * if the item links to a file of the course that Canvas doesn't have:
 * those are sent on their own, never from here, and the link would lead
 * nowhere. The settings returned also have each course file's address in
 * Canvas, for the item's links (see withCanvasFiles); they are not saved.
 */
export const usePrepareImagesForCanvas = () => {
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const withImages = useImagesInCanvas();

  return async (markdown: string[]): Promise<LocalCourseSettings> => {
    const links = linkedFilesInMarkdown(markdown);
    if (!links.length) return withImages(markdown);
    const canvasFiles = await queryClient.ensureQueryData(canvasFilesQuery(settings.canvasId));
    const problem = unsendableLinks(links, await queryClient.fetchQuery({ ...trpc.file.paths.queryOptions(courseName), staleTime: 0 }), canvasFiles);
    if (problem) throw new Error(`Not published: ${problem}`);
    return withCanvasFiles(await withImages(markdown), canvasFiles);
  };
};

/** The course's settings with the item's local images in Canvas (new or changed ones uploaded). */
const useImagesInCanvas = () => {
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const ensureUploaded = useMutation(trpc.canvasFile.ensureImagesUploaded.mutationOptions());
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
