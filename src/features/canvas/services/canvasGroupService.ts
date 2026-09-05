import { canvasApi, paginatedRequest } from "./canvasServiceUtils";
import {
  CanvasGroup,
  CanvasGroupCategory,
  CanvasGroupUser,
} from "../models/groups/canvasGroupModels";

export const canvasGroupService = {
  async getGroupCategories(courseId: number): Promise<CanvasGroupCategory[]> {
    const url = `${canvasApi}/courses/${courseId}/group_categories`;
    return await paginatedRequest<CanvasGroupCategory[]>({ url });
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
