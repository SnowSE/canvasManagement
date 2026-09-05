// Canvas "group sets" are group categories; each holds groups; groups hold users.
export interface CanvasGroupCategory {
  id: number;
  name: string;
  role?: string;
  self_signup?: "enabled" | "restricted" | null;
  context_type: string;
  course_id?: number;
  group_limit?: number | null;
}

export interface CanvasGroup {
  id: number;
  name: string;
  description?: string | null;
  group_category_id: number;
  members_count: number;
  course_id?: number;
  users?: CanvasGroupUser[];
}

export interface CanvasGroupUser {
  id: number;
  name: string;
  sortable_name: string;
  short_name?: string;
  login_id?: string;
  email?: string;
}
