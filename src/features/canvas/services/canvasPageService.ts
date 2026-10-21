import { CanvasPage } from "@/features/canvas/models/pages/canvasPageModel";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { canvasApi, paginatedRequest } from "./canvasServiceUtils";
import { rateLimitAwareDelete, rateLimitAwarePost } from "./canvasWebRequestUtils";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { axiosClient } from "@/services/axiosUtils";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { CanvasLinkTargets } from "@/services/urlUtils";
import { fillEmbed, placeEmbed, renameEmbed } from "./frontPageEmbed";

// Puts a page's html in its marker on the course front page (adding the
// marker at the end if needed), or with no html empties the marker, keeping
// it where it was put.
const updateFrontPage = async (courseId: number, pageUrl: string, html?: string) => {
  const frontPageUrl = `${canvasApi}/courses/${courseId}/front_page`;
  let frontPage: CanvasPage;
  try {
    ({ data: frontPage } = await axiosClient.get<CanvasPage>(frontPageUrl));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error?.response?.status === 404) return;
    throw error;
  }
  if (frontPage.url === pageUrl) return;
  const body = frontPage.body ?? "";
  const updated = html === undefined ? fillEmbed(body, pageUrl, "") : placeEmbed(body, pageUrl, html);
  if (updated === undefined || updated === body) return;
  console.log(`Updating ${pageUrl} on the front page`);
  const { data } = await axiosClient.put<CanvasPage>(frontPageUrl, {
    wiki_page: { body: updated },
  });
  return data;
};

const moveFrontPageMarker = async (courseId: number, fromUrl: string, toUrl: string) => {
  const frontPageUrl = `${canvasApi}/courses/${courseId}/front_page`;
  let frontPage: CanvasPage;
  try {
    ({ data: frontPage } = await axiosClient.get<CanvasPage>(frontPageUrl));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error?.response?.status === 404) return;
    throw error;
  }
  const updated = renameEmbed(frontPage.body ?? "", fromUrl, toUrl);
  if (updated === undefined) return;
  console.log(`Moving the front page marker from ${fromUrl} to ${toUrl}`);
  await axiosClient.put(frontPageUrl, { wiki_page: { body: updated } });
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
  ): Promise<CanvasPage[]> {
    console.log(`Updating course page: ${page.name}`);
    const url = `${canvasApi}/courses/${courseId}/pages/${canvasPage.page_id}`;
    const html = markdownToHTMLSafe({
      markdownString: page.text,
      settings,
      canvasLinkTargets,
    });
    const [{ data: updated }, frontPage] = await Promise.all([
      axiosClient.put<CanvasPage>(url, { wiki_page: { title: page.name, body: html } }),
      page.addToHome === undefined
        ? undefined
        : updateFrontPage(courseId, canvasPage.url, page.addToHome ? html : undefined),
    ]);
    // the pages as Canvas stored them, so the cache can take them as they are
    return frontPage ? [updated, frontPage] : [updated];
  },

  async publish(courseId: number, canvasPageId: number): Promise<void> {
    console.log(`Publishing page ${canvasPageId}`);
    const url = `${canvasApi}/courses/${courseId}/pages/${canvasPageId}`;
    await axiosClient.put(url, { wiki_page: { published: true } });
  },

  // Canvas gives a renamed page a new address, so its front-page marker
  // (keyed on the address) moves with it.
  async rename(
    courseId: number,
    canvasPage: { page_id: number; url: string },
    title: string
  ): Promise<void> {
    console.log(`Renaming page in Canvas to: ${title}`);
    const url = `${canvasApi}/courses/${courseId}/pages/${canvasPage.page_id}`;
    const { data: renamed } = await axiosClient.put<CanvasPage>(url, {
      wiki_page: { title },
    });
    if (renamed.url !== canvasPage.url)
      await moveFrontPageMarker(courseId, canvasPage.url, renamed.url);
  },

  async delete(courseId: number, canvasPageId: number): Promise<void> {
    console.log(`Deleting page from canvas ${canvasPageId}`);
    const url = `${canvasApi}/courses/${courseId}/pages/${canvasPageId}`;
    await rateLimitAwareDelete(url);
  },
};
