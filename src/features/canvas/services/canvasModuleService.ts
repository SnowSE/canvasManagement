import { CanvasModuleItem } from "@/features/canvas/models/modules/canvasModuleItems";
import { canvasApi, paginatedRequest } from "./canvasServiceUtils";
import { CanvasModule } from "@/features/canvas/models/modules/canvasModule";
import { axiosClient } from "@/services/axiosUtils";
import { rateLimitAwarePost } from "./canvasWebRequestUtils";

/** A Canvas item to put in a module; a page is added by its url. */
export interface ModuleItemContent {
  type: "Assignment" | "Quiz" | "Page";
  id: number;
  title: string;
  pageUrl?: string;
}

/** The names of the Canvas modules that hold an item; a page is matched by its url. */
export function canvasModuleNames(
  modules: CanvasModule[],
  type: "assignment" | "quiz" | "page",
  canvasItem: { id?: number; url?: string },
): string[] {
  const holds = (i: CanvasModuleItem) =>
    type === "page"
      ? i.type === "Page" && i.page_url === canvasItem.url
      : i.type === (type === "quiz" ? "Quiz" : "Assignment") &&
        i.content_id === canvasItem.id;
  return modules.filter((m) => m.items?.some(holds)).map((m) => m.name);
}

export const canvasModuleService = {
  async updateModuleItem(
    canvasCourseId: number,
    canvasModuleId: number,
    item: CanvasModuleItem
  ) {
    console.log(`Updating module item ${item.title}`);
    const url = `${canvasApi}/courses/${canvasCourseId}/modules/${canvasModuleId}/items/${item.id}`;
    const body = {
      module_item: { title: item.title, position: item.position },
    };
    const { data } = await axiosClient.put<CanvasModuleItem>(url, body);

    if (!data) throw new Error("Something went wrong updating module item");
  },

  async getModuleWithItems(canvasCourseId: number, moduleId: number) {
    const url = `${canvasApi}/courses/${canvasCourseId}/modules/${moduleId}`;
    const params = { include: ["items"] };
    const response = await axiosClient.get<CanvasModule>(url, { params });
    return response.data;
  },

  async addModuleItem(
    canvasCourseId: number,
    canvasModuleId: number,
    item: ModuleItemContent
  ) {
    await rateLimitAwarePost<CanvasModuleItem>(
      `${canvasApi}/courses/${canvasCourseId}/modules/${canvasModuleId}/items`,
      {
        module_item:
          item.type === "Page"
            ? { title: item.title, type: "Page", page_url: item.pageUrl }
            : { title: item.title, type: item.type, content_id: item.id },
      }
    );
  },

  /**
   * Puts an item in a module: leaves it if it's already there, moves it from
   * another module, or adds it when it's in none.
   */
  async placeInModule(
    canvasCourseId: number,
    canvasModuleId: number,
    item: ModuleItemContent
  ): Promise<"already" | "moved" | "added"> {
    const { data } = await axiosClient.get<{
      items: { current?: { id: number; module_id: number } }[];
    }>(`${canvasApi}/courses/${canvasCourseId}/module_item_sequence`, {
      params: { asset_type: item.type, asset_id: item.id },
    });
    const placements = data.items.flatMap((i) => (i.current ? [i.current] : []));
    if (placements.some((p) => p.module_id === canvasModuleId)) return "already";

    if (placements.length > 0) {
      const [from] = placements;
      await axiosClient.put(
        `${canvasApi}/courses/${canvasCourseId}/modules/${from.module_id}/items/${from.id}`,
        { module_item: { module_id: canvasModuleId } }
      );
      return "moved";
    }

    await canvasModuleService.addModuleItem(canvasCourseId, canvasModuleId, item);
    return "added";
  },

  async getCourseModules(canvasCourseId: number) {
    const url = `${canvasApi}/courses/${canvasCourseId}/modules`;
    const response = await paginatedRequest<CanvasModule[]>({ url });
    return response;
  },

  /** Every module with its items; Canvas leaves the items out of a large module, so those are fetched on their own. */
  async getCourseModulesWithItems(canvasCourseId: number) {
    const modules = await paginatedRequest<CanvasModule[]>({
      url: `${canvasApi}/courses/${canvasCourseId}/modules?include[]=items`,
    });
    return Promise.all(
      modules.map(async (m) =>
        m.items
          ? m
          : {
              ...m,
              items: await paginatedRequest<CanvasModuleItem[]>({
                url: `${canvasApi}/courses/${canvasCourseId}/modules/${m.id}/items`,
              }),
            }
      )
    );
  },

  async createModule(canvasCourseId: number, moduleName: string) {
    const url = `${canvasApi}/courses/${canvasCourseId}/modules`;
    const body = {
      module: {
        name: moduleName,
      },
    };
    const response = await rateLimitAwarePost<CanvasModule>(url, body);
    return response.data.id;
  },

  async reorderModuleItems(
    canvasCourseId: number,
    canvasModuleId: number,
    itemIds: number[]
  ) {
    for (let i = 0; i < itemIds.length; i++) {
      const itemId = itemIds[i];
      const url = `${canvasApi}/courses/${canvasCourseId}/modules/${canvasModuleId}/items/${itemId}`;
      const body = {
        module_item: {
          position: i + 1,
        },
      };
      await axiosClient.put(url, body);
    }
  },
};
