import { canvasApi, paginatedRequest } from "./canvasServiceUtils";
import {
  CanvasGroup,
  CanvasGroupCategory,
  CanvasGroupUser,
} from "../models/groups/canvasGroupModels";

export const canvasGroupService = {
  async getGroupCategories(courseId: number): Promise<CanvasGroupCategory[]> {
    const url = `${canvasApi}/courses/${courseId}/group_categories`;
    try {
      return await paginatedRequest<CanvasGroupCategory[]>({ url });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // a course whose term has ended is read-only, and Canvas refuses to
      // list its group sets; there are none to assign there anyway
      if (error?.response?.status === 403) return [];
      throw error;
    }
  },

  async getGroupsInCategory(groupCategoryId: number): Promise<CanvasGroup[]> {
    const url = `${canvasApi}/group_categories/${groupCategoryId}/groups`;
    return await paginatedRequest<CanvasGroup[]>({ url });
  },

  async getGroupUsers(groupId: number): Promise<CanvasGroupUser[]> {
    const url = `${canvasApi}/groups/${groupId}/users`;
    return await paginatedRequest<CanvasGroupUser[]>({ url });
  },
};
