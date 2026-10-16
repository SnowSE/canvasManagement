import { CanvasPage } from "@/features/canvas/models/pages/canvasPageModel";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { canvasApi, paginatedRequest } from "./canvasServiceUtils";
import { rateLimitAwareDelete, rateLimitAwarePost } from "./canvasWebRequestUtils";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { axiosClient } from "@/services/axiosUtils";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { CanvasLinkTargets } from "@/services/urlUtils";
import { fillEmbed } from "./frontPageEmbed";

// undefined when the course has no front page
const getFrontPage = async (courseId: number) => {
  try {
    const { data } = await axiosClient.get<CanvasPage>(
      `${canvasApi}/courses/${courseId}/front_page`
    );
    return data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error?.response?.status === 404) return undefined;
    throw error;
  }
};

export const canvasPageService = {
  async getAll(courseId: number): Promise<CanvasPage[]> {
    try {
      // body lets the sync status compare page content
      const url = `${canvasApi}/courses/${courseId}/pages?include[]=body`;
      const pages = await paginatedRequest<CanvasPage[]>({
        url,
      });
      return pages.flatMap((pageList) => pageList);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.status === 403) {
        console.log(
          "Canvas API error: 403 Forbidden for pages. Returning empty array."
        );
        return [];
      }
      throw error;
    }
  },

  async create(
    canvasCourseId: number,
    page: LocalCoursePage,
    settings: LocalCourseSettings,
    canvasLinkTargets?: CanvasLinkTargets
  ): Promise<CanvasPage> {
    console.log(`Creating course page: ${page.name}`);
    const url = `${canvasApi}/courses/${canvasCourseId}/pages`;
    const body = {
      wiki_page: {
        title: page.name,
        body: markdownToHTMLSafe({
          markdownString: page.text,
          settings,
          canvasLinkTargets,
        }),
      },
    };

    const { data: canvasPage } = await rateLimitAwarePost<CanvasPage>(url, body);
    if (!canvasPage) {
      throw new Error("Created canvas course page was null");
    }
    return canvasPage;
  },

  async update(
    courseId: number,
    canvasPage: { page_id: number; url: string },
    page: LocalCoursePage,
    settings: LocalCourseSettings,
    canvasLinkTargets?: CanvasLinkTargets
  ): Promise<void> {
    console.log(`Updating course page: ${page.name}`);
    const url = `${canvasApi}/courses/${courseId}/pages/${canvasPage.page_id}`;
    const html = markdownToHTMLSafe({
      markdownString: page.text,
      settings,
      canvasLinkTargets,
    });
    const [, frontPage] = await Promise.all([
      axiosClient.put(url, { wiki_page: { title: page.name, body: html } }),
      getFrontPage(courseId),
    ]);
    if (!frontPage || frontPage.url === canvasPage.url) return;
    const filled = fillEmbed(frontPage.body ?? "", canvasPage.url, html);
    if (filled === undefined) return;
    console.log(`Filling ${canvasPage.url} into the front page`);
    await axiosClient.put(`${canvasApi}/courses/${courseId}/front_page`, {
      wiki_page: { body: filled },
    });
  },

  async publish(courseId: number, canvasPageId: number): Promise<void> {
    console.log(`Publishing page ${canvasPageId}`);
    const url = `${canvasApi}/courses/${courseId}/pages/${canvasPageId}`;
    await axiosClient.put(url, { wiki_page: { published: true } });
  },

  async delete(courseId: number, canvasPageId: number): Promise<void> {
    console.log(`Deleting page from canvas ${canvasPageId}`);
    const url = `${canvasApi}/courses/${courseId}/pages/${canvasPageId}`;
    await rateLimitAwareDelete(url);
  },
};
